import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

const CARDS_COLLECTION = "cards";
const ACTIVITY_COLLECTION = "audit_log";
const SESSION_KEY = "pix-board-session-v1";

const EMPRESAS = [
  {
    id: "leao",
    nome: "Churrascaria Leão do Parque",
    curto: "Leão",
    pin: "1234",
    classes: {
      header: "bg-emerald-700",
      headerText: "text-emerald-50",
      dot: "bg-emerald-600",
      card: "bg-emerald-50 border-emerald-300",
      cardAccent: "text-emerald-800",
      badge: "bg-emerald-100 text-emerald-800",
      btn: "bg-emerald-700 hover:bg-emerald-800",
    },
  },
  {
    id: "pier49",
    nome: "Restaurante Pier 49",
    curto: "Pier 49",
    pin: "4321",
    classes: {
      header: "bg-sky-700",
      headerText: "text-sky-50",
      dot: "bg-sky-600",
      card: "bg-sky-50 border-sky-300",
      cardAccent: "text-sky-800",
      badge: "bg-sky-100 text-sky-800",
      btn: "bg-sky-700 hover:bg-sky-800",
    },
  },
  {
    id: "centro",
    nome: "Padaria Gaúcha Centro",
    curto: "Centro",
    pin: "9874",
    classes: {
      header: "bg-amber-700",
      headerText: "text-amber-50",
      dot: "bg-amber-600",
      card: "bg-amber-50 border-amber-300",
      cardAccent: "text-amber-800",
      badge: "bg-amber-100 text-amber-800",
      btn: "bg-amber-700 hover:bg-amber-800",
    },
  },
  {
    id: "cassino",
    nome: "Padaria Gaúcha Cassino",
    curto: "Cassino",
    pin: "4789",
    classes: {
      header: "bg-stone-700",
      headerText: "text-stone-50",
      dot: "bg-stone-600",
      card: "bg-stone-50 border-stone-300",
      cardAccent: "text-stone-800",
      badge: "bg-stone-200 text-stone-800",
      btn: "bg-stone-700 hover:bg-stone-800",
    },
  },
];

const FEITO_COLUMN = {
  id: "feito",
  nome: "Feito",
  curto: "Feito",
  classes: {
    header: "bg-slate-600",
    headerText: "text-slate-50",
    dot: "bg-slate-500",
    card: "bg-slate-50 border-slate-300",
    cardAccent: "text-slate-700",
    badge: "bg-slate-200 text-slate-700",
    btn: "bg-slate-600 hover:bg-slate-700",
  },
};

const COLUMNS = [...EMPRESAS, FEITO_COLUMN];
const CHEFE_PIN = "2707";

function empresaById(id) {
  return EMPRESAS.find((e) => e.id === id);
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// O Firestore aceita no máximo 500 operações por batch.
const BATCH_LIMIT = 450;

async function commitInChunks(items, applyOp) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = window.db.batch();
    items.slice(i, i + BATCH_LIMIT).forEach((item) => applyOp(batch, item));
    await batch.commit();
  }
}

function cardStatus(card) {
  if (card.archived) return "Arquivado";
  if (card.columnId === "feito") return "Feito";
  return "Pendente";
}

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDateFull(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

// CSV com ";" e vírgula decimal, que é o que o Excel em português espera.
function cardsToCsv(list) {
  const header = ["Estabelecimento", "Favorecido", "Chave PIX", "Descrição", "Valor", "Comprovante", "Status", "Criado em", "Enviado em"];
  const rows = list.map((c) => {
    const origem = empresaById(c.origemId);
    return [
      origem ? origem.nome : c.origemId,
      c.favorecido,
      c.chavePix,
      c.descricao,
      Number(c.valor || 0).toFixed(2).replace(".", ","),
      c.precisaComprovante ? "Sim" : "Não",
      cardStatus(c),
      formatDateFull(c.createdAt),
      formatDateFull(c.pagoEm),
    ];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Chave "AAAA-MM" do mês em que o PIX foi criado (horário local).
function monthKey(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [ano, mes] = key.split("-");
  return `${MESES[Number(mes) - 1]} ${ano}`;
}

function downloadCsv(list, nomeBase, comData = true) {
  const blob = new Blob(["﻿" + cardsToCsv(list)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = comData ? `${nomeBase}-${new Date().toISOString().slice(0, 10)}.csv` : `${nomeBase}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Icon({ name, size = 16, className = "" }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "plus":
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "x":
      return <svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>;
    case "logout":
      return (
        <svg {...p}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "copy":
      return (
        <svg {...p}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "check":
      return <svg {...p}><polyline points="20 6 9 17 4 12" /></svg>;
    case "lock":
      return (
        <svg {...p}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...p}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case "archive":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="4" rx="1" />
          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
          <path d="M10 12h4" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...p}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      );
    case "download":
      return (
        <svg {...p}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    default:
      return null;
  }
}

function Spinner({ size = 14, className = "" }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Campo de formulário com destaque em vermelho e a mensagem de erro logo abaixo.
function FormField({ error, className = "", ...props }) {
  return (
    <div className="mb-1.5">
      <input
        {...props}
        aria-invalid={error ? "true" : undefined}
        className={`w-full text-base sm:text-sm border rounded px-2 py-2 sm:py-1.5 ${
          error ? "border-red-500 bg-red-50" : "border-neutral-300"
        } ${className}`}
      />
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

// Valida os campos do PIX e devolve os erros por campo e o valor numérico.
function validatePix(d, exigeComprovante) {
  const errors = {};
  if (!d.chavePix.trim()) errors.chavePix = "Informe a chave PIX.";
  if (!d.favorecido.trim()) errors.favorecido = "Informe o favorecido.";
  const numeric = Number(String(d.valor).replace(",", "."));
  if (!String(d.valor).trim()) errors.valor = "Informe o valor.";
  else if (Number.isNaN(numeric) || numeric <= 0) errors.valor = "Informe um valor válido (ex: 150,00).";
  if (exigeComprovante && d.comprovante === null) errors.comprovante = "Selecione se precisa de comprovante.";
  return { errors, numeric };
}

function FalhaTela({ mensagem }) {
  return (
    <div className="font-ui w-full min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-5 text-center">
        <h1 className="font-display text-xl text-neutral-900 mb-2">Algo deu errado</h1>
        <p className="text-sm text-neutral-600 mb-4">{mensagem}</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-neutral-900 text-white rounded-md py-2.5 hover:bg-neutral-800"
        >
          Recarregar a página
        </button>
      </div>
    </div>
  );
}

// Evita a tela branca se acontecer algum erro inesperado na tela.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (this.state.hasError) {
      return <FalhaTela mensagem="O quadro encontrou um problema inesperado. Recarregue a página para continuar." />;
    }
    return this.props.children;
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function PixBoard() {
  const [session, setSession] = useState(loadSession);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [openForm, setOpenForm] = useState(null);
  const [draft, setDraft] = useState({ chavePix: "", favorecido: "", descricao: "", valor: "", comprovante: null });
  const [formErrors, setFormErrors] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [confirmClearFeito, setConfirmClearFeito] = useState(false);
  const [confirmResetReport, setConfirmResetReport] = useState(false);
  const [resetBackupDone, setResetBackupDone] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editDraft, setEditDraft] = useState({ chavePix: "", favorecido: "", descricao: "", valor: "", comprovante: null });
  const [editErrors, setEditErrors] = useState({});
  const [page, setPage] = useState("board");
  const [searchQuery, setSearchQuery] = useState("");
  // "current" = mês atual, "all" = todos os meses, ou "AAAA-MM" de um mês arquivado.
  const [reportMonth, setReportMonth] = useState("current");
  const [activities, setActivities] = useState([]);
  // No celular o quadro mostra uma coluna por vez, escolhida pelas abas.
  const [mobileCol, setMobileCol] = useState(null);
  // Ação em andamento no Firestore ("add", "edit", "delete", "archive", "reset"), para travar clique duplo.
  const [busy, setBusy] = useState(null);
  const [movingIds, setMovingIds] = useState([]);
  const [syncFailed, setSyncFailed] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  useEffect(() => {
    const unsub = window.db.collection(CARDS_COLLECTION).onSnapshot(
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCards(list);
        setLoading(false);
        setLoadError("");
        setSyncFailed(false);
      },
      (err) => {
        console.error(err);
        setLoadError("Não foi possível conectar ao servidor. Verifique a internet e recarregue a página.");
        setSyncFailed(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!session || session.type !== "chefe") return;
    setActivitiesLoading(true);
    setActivitiesError("");
    const unsub = window.db
      .collection(ACTIVITY_COLLECTION)
      .orderBy("em", "desc")
      .limit(200)
      .onSnapshot(
        (snapshot) => {
          setActivities(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setActivitiesLoading(false);
          setActivitiesError("");
        },
        (err) => {
          console.error(err);
          setActivitiesError("Não foi possível carregar as atividades. Verifique a internet e recarregue a página.");
          setActivitiesLoading(false);
        }
      );
    return () => unsub();
  }, [session]);

  function atorAtual() {
    if (!session) return "Desconhecido";
    if (session.type === "chefe") return "Chefe";
    const emp = empresaById(session.id);
    return emp ? emp.nome : "Desconhecido";
  }

  async function logActivity(acao, detalhe) {
    try {
      await window.db.collection(ACTIVITY_COLLECTION).add({
        acao,
        ator: atorAtual(),
        detalhe,
        em: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Falha ao registrar atividade", e);
    }
  }

  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }, [session]);

  function handleSelectRole(role) {
    setSelectedRole(role);
    setPinInput("");
    setLoginError("");
  }

  function handleLoginSubmit() {
    if (!selectedRole) return;
    if (selectedRole.type === "chefe") {
      if (pinInput === CHEFE_PIN) {
        setSession({ type: "chefe" });
      } else {
        setLoginError("PIN incorreto.");
      }
    } else {
      const empresa = empresaById(selectedRole.id);
      if (empresa && pinInput === empresa.pin) {
        setSession({ type: "empresa", id: empresa.id });
      } else {
        setLoginError("PIN incorreto.");
      }
    }
  }

  function handleLogout() {
    setSession(null);
    setSelectedRole(null);
    setPinInput("");
    setPage("board");
    setMobileCol(null);
  }

  function canAddTo(columnId) {
    if (!session) return false;
    if (session.type === "chefe") return columnId !== "feito";
    return session.type === "empresa" && session.id === columnId;
  }

  function openAddForm(columnId) {
    setOpenForm(columnId);
    setDraft({ chavePix: "", favorecido: "", descricao: "", valor: "", comprovante: null });
    setFormErrors({});
  }

  function setDraftField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
    setFormErrors((errs) => ({ ...errs, [field]: undefined, geral: undefined }));
  }

  function setEditField(field, value) {
    setEditDraft((d) => ({ ...d, [field]: value }));
    setEditErrors((errs) => ({ ...errs, [field]: undefined, geral: undefined }));
  }

  async function submitCard(columnId) {
    if (busy) return;
    const { errors, numeric } = validatePix(draft, true);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    const id = uid();
    const newCard = {
      columnId,
      origemId: columnId,
      chavePix: draft.chavePix.trim(),
      favorecido: draft.favorecido.trim(),
      descricao: draft.descricao.trim(),
      valor: numeric,
      precisaComprovante: draft.comprovante === true,
      createdAt: new Date().toISOString(),
      archived: false,
    };
    setBusy("add");
    try {
      await window.db.collection(CARDS_COLLECTION).doc(id).set(newCard);
      setOpenForm(null);
      setLoadError("");
      logActivity("criar", `Novo PIX para ${newCard.favorecido} · ${formatMoney(newCard.valor)}`);
    } catch (e) {
      setFormErrors({ geral: "Não foi possível salvar agora. Verifique a internet e tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  async function moveCard(cardId, targetColumnId) {
    if (!session || session.type !== "chefe") return;
    if (movingIds.includes(cardId)) return;
    const card = cards.find((c) => c.id === cardId);
    const update = { columnId: targetColumnId };
    if (targetColumnId === "feito") {
      update.pagoEm = new Date().toISOString();
    } else {
      update.pagoEm = null;
    }
    setMovingIds((ids) => [...ids, cardId]);
    try {
      await window.db.collection(CARDS_COLLECTION).doc(cardId).update(update);
      if (card) {
        if (targetColumnId === "feito") {
          logActivity("concluir", `Marcou como feito o PIX de ${card.favorecido} · ${formatMoney(card.valor)}`);
        } else {
          const destino = empresaById(targetColumnId);
          logActivity("devolver", `Devolveu para ${destino ? destino.nome : targetColumnId} o PIX de ${card.favorecido}`);
        }
      }
    } catch (e) {
      setLoadError("Não foi possível mover o card agora. Verifique a internet e tente novamente.");
    } finally {
      setMovingIds((ids) => ids.filter((x) => x !== cardId));
    }
  }

  async function markAsDone(cardId) {
    await moveCard(cardId, "feito");
  }

  async function deleteCard(cardId) {
    if (!session || session.type !== "chefe") return;
    if (busy) return;
    const card = cards.find((c) => c.id === cardId);
    setBusy("delete");
    try {
      await window.db.collection(CARDS_COLLECTION).doc(cardId).delete();
      if (card) {
        logActivity("excluir", `Excluiu o PIX de ${card.favorecido} · ${formatMoney(card.valor)}`);
      }
    } catch (e) {
      setLoadError("Não foi possível excluir agora. Verifique a internet e tente novamente.");
    } finally {
      setBusy(null);
      setConfirmDeleteId(null);
    }
  }

  function canEdit(card) {
    if (!session || card.archived) return false;
    if (session.type === "chefe") return true;
    return session.type === "empresa" && session.id === card.origemId && card.columnId === card.origemId;
  }

  function startEdit(card) {
    setEditingCardId(card.id);
    setEditDraft({
      chavePix: card.chavePix,
      favorecido: card.favorecido,
      descricao: card.descricao || "",
      valor: String(card.valor),
      comprovante: !!card.precisaComprovante,
    });
    setEditErrors({});
  }

  function cancelEdit() {
    setEditingCardId(null);
    setEditErrors({});
  }

  async function submitEdit(cardId) {
    if (busy) return;
    const { errors, numeric } = validatePix(editDraft, false);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setBusy("edit");
    try {
      await window.db.collection(CARDS_COLLECTION).doc(cardId).update({
        chavePix: editDraft.chavePix.trim(),
        favorecido: editDraft.favorecido.trim(),
        descricao: editDraft.descricao.trim(),
        valor: numeric,
        precisaComprovante: editDraft.comprovante === true,
      });
      setEditingCardId(null);
      logActivity("editar", `Editou o PIX de ${editDraft.favorecido.trim()} · ${formatMoney(numeric)}`);
    } catch (e) {
      setEditErrors({ geral: "Não foi possível salvar agora. Verifique a internet e tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  async function archiveAllDone() {
    if (!session || session.type !== "chefe") return;
    if (busy) return;
    setBusy("archive");
    try {
      const alvo = cards.filter((c) => c.columnId === "feito" && !c.archived);
      const archivedAt = new Date().toISOString();
      await commitInChunks(alvo, (batch, c) =>
        batch.update(window.db.collection(CARDS_COLLECTION).doc(c.id), { archived: true, archivedAt })
      );
      if (alvo.length > 0) logActivity("arquivar", `Arquivou ${alvo.length} PIX concluídos`);
    } catch (e) {
      setLoadError("Não foi possível arquivar agora. Verifique a internet e tente novamente.");
    } finally {
      setBusy(null);
      setConfirmClearFeito(false);
    }
  }

  async function resetAllReports() {
    if (!session || session.type !== "chefe") return;
    if (busy) return;
    const alvo = cards;
    setBusy("reset");
    try {
      await commitInChunks(alvo, (batch, c) => batch.delete(window.db.collection(CARDS_COLLECTION).doc(c.id)));
      if (alvo.length > 0) logActivity("zerar", `Zerou todos os relatórios (${alvo.length} PIX apagados)`);
    } catch (e) {
      setLoadError("Não foi possível zerar tudo. Alguns PIX podem não ter sido apagados; tente de novo.");
    } finally {
      setBusy(null);
      setConfirmResetReport(false);
      setResetBackupDone(false);
    }
  }

  function openResetConfirm() {
    setResetBackupDone(false);
    setConfirmResetReport(true);
  }

  function copyPix(id, chave) {
    navigator.clipboard && navigator.clipboard.writeText(chave);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  }

  function columnTotal(columnId) {
    return cards
      .filter((c) => c.columnId === columnId && !c.archived)
      .reduce((sum, c) => sum + Number(c.valor || 0), 0);
  }

  function matchesSearch(card) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (card.favorecido || "").toLowerCase().includes(q) ||
      (card.chavePix || "").toLowerCase().includes(q) ||
      (card.descricao || "").toLowerCase().includes(q)
    );
  }

  function activityIcon(acao) {
    switch (acao) {
      case "criar":
        return "plus";
      case "editar":
        return "file-text";
      case "concluir":
        return "check";
      case "devolver":
        return "arrow-right";
      case "excluir":
        return "trash";
      case "arquivar":
        return "archive";
      case "zerar":
        return "trash";
      default:
        return "file-text";
    }
  }

  if (loading) {
    return (
      <div className="font-ui w-full min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-500 text-sm flex items-center gap-2" role="status">
          <Spinner size={16} /> Carregando PIX…
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="font-ui w-full min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl text-neutral-900 mb-1 text-center">Quadro de PIX</h1>
          <p className="text-neutral-500 text-sm text-center mb-8">Controle de pagamentos por estabelecimento</p>

          {(syncFailed || !online) && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
              {!online ? "Sem conexão com a internet. O quadro volta a funcionar quando a conexão voltar." : loadError}
            </div>
          )}

          {!selectedRole ? (
            <div className="grid grid-cols-1 gap-2">
              {EMPRESAS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelectRole({ type: "empresa", id: e.id })}
                  className="flex items-center gap-3 bg-white border border-neutral-200 rounded-lg px-4 py-3 text-left hover:border-neutral-400 transition-colors"
                >
                  <span className={`w-3 h-3 rounded-full ${e.classes.dot}`} />
                  <span className="text-neutral-800 font-medium">{e.nome}</span>
                </button>
              ))}
              <button
                onClick={() => handleSelectRole({ type: "chefe" })}
                className="flex items-center gap-3 bg-neutral-900 rounded-lg px-4 py-3 text-left hover:bg-neutral-800 transition-colors mt-2"
              >
                <Icon name="lock" size={16} className="text-neutral-300" />
                <span className="text-white font-medium">Entrar como chefe</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <p className="text-sm text-neutral-500 mb-3">
                {selectedRole.type === "chefe" ? "Chefe" : empresaById(selectedRole.id).nome}
              </p>
              <label className="block text-sm text-neutral-700 mb-1">PIN</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={8}
                value={pinInput}
                onChange={(ev) => {
                  setPinInput(ev.target.value.replace(/[^0-9]/g, ""));
                  setLoginError("");
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") handleLoginSubmit();
                }}
                aria-invalid={loginError ? "true" : undefined}
                className={`w-full border rounded-md px-3 py-2 mb-2 tracking-widest text-lg font-mono-num ${
                  loginError ? "border-red-500 bg-red-50" : "border-neutral-300"
                }`}
                placeholder="Digite o PIN"
              />
              {loginError && <p className="text-sm text-red-600 mb-2">{loginError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="flex-1 border border-neutral-300 rounded-md py-2 text-neutral-700 hover:bg-neutral-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleLoginSubmit}
                  className="flex-1 bg-neutral-900 text-white rounded-md py-2 hover:bg-neutral-800 flex items-center justify-center gap-1"
                >
                  Entrar <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="font-ui w-full min-h-screen bg-neutral-50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl text-neutral-900">Quadro de PIX</h1>
          <p className="text-sm text-neutral-500 truncate">
            {session.type === "chefe" ? "Você está como chefe" : `Você está em ${empresaById(session.id).nome}`}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex-shrink-0 flex items-center gap-1 text-sm text-neutral-600 border border-neutral-300 rounded-md px-3 py-2 sm:py-1.5 hover:bg-white"
        >
          <Icon name="logout" size={14} /> Sair
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
        <button
          onClick={() => setPage("board")}
          className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-2 sm:py-1.5 ${
            page === "board" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-300 text-neutral-600"
          }`}
        >
          <Icon name="grid" size={14} /> Quadro
        </button>
        {session.type === "chefe" && (
          <button
            onClick={() => setPage("report")}
            className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-2 sm:py-1.5 ${
              page === "report" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-300 text-neutral-600"
            }`}
          >
            <Icon name="file-text" size={14} /> Relatório
          </button>
        )}
        {session.type === "chefe" && (
          <button
            onClick={() => setPage("activities")}
            className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-2 sm:py-1.5 ${
              page === "activities" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-300 text-neutral-600"
            }`}
          >
            <Icon name="clock" size={14} /> Atividades
          </button>
        )}
        {page === "board" && (
          <div className="relative ml-auto w-full sm:w-64">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar favorecido ou chave PIX"
              className="w-full text-base sm:text-sm border border-neutral-300 rounded-md pl-8 pr-2.5 py-2 sm:py-1.5 bg-white"
            />
          </div>
        )}
      </div>

      {!online && (
        <div className="mb-3 mx-1 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
          Sem conexão com a internet. O que você fizer agora só será salvo quando a conexão voltar.
        </div>
      )}

      {loadError && (
        <div
          className="mb-3 mx-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex flex-wrap items-center justify-between gap-2"
          role="alert"
        >
          <span>{loadError}</span>
          {syncFailed && (
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium border border-red-300 rounded-md px-3 py-1.5 bg-white hover:bg-red-100"
            >
              Recarregar
            </button>
          )}
        </div>
      )}

      {page === "board" && (() => {
        const activeMobileCol = mobileCol || (session.type === "empresa" ? session.id : COLUMNS[0].id);
        const columnCards = (colId) => cards.filter((c) => c.columnId === colId && !c.archived && matchesSearch(c));
        return (
        <>
        <div className="md:hidden no-scrollbar flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-3 px-3">
          {COLUMNS.map((col) => {
            const active = col.id === activeMobileCol;
            return (
              <button
                key={col.id}
                onClick={() => setMobileCol(col.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 text-sm rounded-full px-3 py-2 border whitespace-nowrap ${
                  active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${col.classes.dot}`} />
                {col.curto}
                <span className={`text-xs font-mono-num ${active ? "text-neutral-300" : "text-neutral-400"}`}>
                  {columnCards(col.id).length}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 md:overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const colCards = columnCards(col.id);
            const isDropTarget = session.type === "chefe" && col.id === "feito";
            return (
              <div
                key={col.id}
                className={`${col.id === activeMobileCol ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 flex-shrink-0 rounded-lg border ${
                  dragOverCol === col.id ? "border-neutral-400" : "border-neutral-200"
                } bg-white md:max-h-[75vh]`}
                onDragOver={(e) => {
                  if (isDropTarget) {
                    e.preventDefault();
                    setDragOverCol(col.id);
                  }
                }}
                onDragLeave={() => setDragOverCol((prev) => (prev === col.id ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  if (!isDropTarget) return;
                  const cardId = e.dataTransfer.getData("text/plain");
                  if (cardId) moveCard(cardId, col.id);
                }}
              >
                <div className={`${col.classes.header} ${col.classes.headerText} rounded-t-lg px-3 py-2.5 flex items-center justify-between`}>
                  <div>
                    <p className="font-medium text-sm leading-tight">{col.nome}</p>
                    <p className="text-xs opacity-80 font-mono-num">
                      {formatMoney(columnTotal(col.id))} · {colCards.length} PIX
                    </p>
                  </div>
                  {canAddTo(col.id) && (
                    <button
                      onClick={() => openAddForm(col.id)}
                      aria-label={`Adicionar PIX em ${col.nome}`}
                      className="bg-white/15 hover:bg-white/25 rounded-md p-2 md:p-1.5"
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  )}
                  {col.id === "feito" && session.type === "chefe" && colCards.length > 0 && (
                    <button
                      onClick={() => setConfirmClearFeito(true)}
                      aria-label="Arquivar todos os feitos"
                      className="bg-white/15 hover:bg-white/25 rounded-md p-2 md:p-1.5"
                    >
                      <Icon name="archive" size={16} />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                  {openForm === col.id && (
                    <div className="border border-neutral-300 rounded-md p-2.5 bg-neutral-50">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-medium text-neutral-600">Novo PIX</p>
                        <button
                          onClick={() => setOpenForm(null)}
                          disabled={busy === "add"}
                          aria-label="Cancelar"
                          className="-m-1.5 p-1.5 disabled:opacity-40"
                        >
                          <Icon name="x" size={14} className="text-neutral-500" />
                        </button>
                      </div>
                      <FormField
                        placeholder="Chave PIX"
                        value={draft.chavePix}
                        onChange={(e) => setDraftField("chavePix", e.target.value)}
                        error={formErrors.chavePix}
                      />
                      <FormField
                        placeholder="Favorecido"
                        value={draft.favorecido}
                        onChange={(e) => setDraftField("favorecido", e.target.value)}
                        error={formErrors.favorecido}
                      />
                      <FormField
                        placeholder="Descrição"
                        value={draft.descricao}
                        onChange={(e) => setDraftField("descricao", e.target.value)}
                      />
                      <FormField
                        placeholder="Valor (ex: 150,00)"
                        inputMode="decimal"
                        value={draft.valor}
                        onChange={(e) => setDraftField("valor", e.target.value)}
                        error={formErrors.valor}
                        className="font-mono-num"
                      />
                      <p className="text-xs text-neutral-500 mb-1">Comprovante</p>
                      <div className={`flex gap-1.5 ${formErrors.comprovante ? "mb-0.5" : "mb-1.5"}`}>
                        <button
                          type="button"
                          onClick={() => setDraftField("comprovante", true)}
                          className={`flex-1 text-sm rounded px-2 py-2 sm:py-1.5 border ${
                            draft.comprovante === true
                              ? "bg-neutral-900 text-white border-neutral-900"
                              : formErrors.comprovante
                              ? "bg-red-50 text-neutral-600 border-red-500"
                              : "bg-white text-neutral-600 border-neutral-300"
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftField("comprovante", false)}
                          className={`flex-1 text-sm rounded px-2 py-2 sm:py-1.5 border ${
                            draft.comprovante === false
                              ? "bg-neutral-900 text-white border-neutral-900"
                              : formErrors.comprovante
                              ? "bg-red-50 text-neutral-600 border-red-500"
                              : "bg-white text-neutral-600 border-neutral-300"
                          }`}
                        >
                          Não
                        </button>
                      </div>
                      {formErrors.comprovante && <p className="text-xs text-red-600 mb-1.5">{formErrors.comprovante}</p>}
                      {formErrors.geral && <p className="text-xs text-red-600 mb-1.5" role="alert">{formErrors.geral}</p>}
                      <button
                        onClick={() => submitCard(col.id)}
                        disabled={busy === "add"}
                        className={`w-full text-white text-sm rounded py-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ${col.classes.btn}`}
                      >
                        {busy === "add" ? (
                          <>
                            <Spinner size={14} /> Salvando…
                          </>
                        ) : (
                          "Adicionar"
                        )}
                      </button>
                    </div>
                  )}

                  {colCards.length === 0 && openForm !== col.id && (
                    <p className="text-xs text-neutral-400 text-center py-6">
                      {syncFailed && cards.length === 0
                        ? "Não foi possível carregar os PIX."
                        : searchQuery.trim()
                        ? "Nenhum PIX encontrado para essa busca."
                        : "Nenhum PIX ainda."}
                    </p>
                  )}

                  {colCards.map((card) => {
                    const origem = empresaById(card.origemId);
                    const isEditing = editingCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        draggable={!isEditing && session.type === "chefe" && card.columnId !== "feito"}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                        className={`border rounded-md p-2.5 ${col.classes.card} ${
                          !isEditing && session.type === "chefe" && card.columnId !== "feito" ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        {isEditing ? (
                          <div>
                            <p className="text-xs font-medium text-neutral-600 mb-2">Editar PIX</p>
                            <FormField
                              placeholder="Chave PIX"
                              value={editDraft.chavePix}
                              onChange={(e) => setEditField("chavePix", e.target.value)}
                              error={editErrors.chavePix}
                            />
                            <FormField
                              placeholder="Favorecido"
                              value={editDraft.favorecido}
                              onChange={(e) => setEditField("favorecido", e.target.value)}
                              error={editErrors.favorecido}
                            />
                            <FormField
                              placeholder="Descrição"
                              value={editDraft.descricao}
                              onChange={(e) => setEditField("descricao", e.target.value)}
                            />
                            <FormField
                              placeholder="Valor (ex: 150,00)"
                              inputMode="decimal"
                              value={editDraft.valor}
                              onChange={(e) => setEditField("valor", e.target.value)}
                              error={editErrors.valor}
                              className="font-mono-num"
                            />
                            <p className="text-xs text-neutral-500 mb-1">Comprovante</p>
                            <div className="flex gap-1.5 mb-1.5">
                              <button
                                type="button"
                                onClick={() => setEditField("comprovante", true)}
                                className={`flex-1 text-sm rounded px-2 py-2 sm:py-1.5 border ${
                                  editDraft.comprovante === true
                                    ? "bg-neutral-900 text-white border-neutral-900"
                                    : "bg-white text-neutral-600 border-neutral-300"
                                }`}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditField("comprovante", false)}
                                className={`flex-1 text-sm rounded px-2 py-2 sm:py-1.5 border ${
                                  editDraft.comprovante === false
                                    ? "bg-neutral-900 text-white border-neutral-900"
                                    : "bg-white text-neutral-600 border-neutral-300"
                                }`}
                              >
                                Não
                              </button>
                            </div>
                            {editErrors.geral && <p className="text-xs text-red-600 mb-1.5" role="alert">{editErrors.geral}</p>}
                            <div className="flex gap-1.5">
                              <button
                                onClick={cancelEdit}
                                disabled={busy === "edit"}
                                className="flex-1 border border-neutral-300 rounded py-2.5 sm:py-1.5 text-sm text-neutral-600 disabled:opacity-40"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => submitEdit(card.id)}
                                disabled={busy === "edit"}
                                className={`flex-1 text-white text-sm rounded py-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ${col.classes.btn}`}
                              >
                                {busy === "edit" ? (
                                  <>
                                    <Spinner size={14} /> Salvando…
                                  </>
                                ) : (
                                  "Salvar"
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${origem ? origem.classes.badge : col.classes.badge}`}>
                                {origem ? origem.curto : "Feito"}
                              </span>
                              <span className="text-[11px] text-neutral-400 font-mono-num">{formatDate(card.createdAt)}</span>
                            </div>
                            <p className="font-medium text-sm text-neutral-900">{card.favorecido}</p>
                            {card.descricao && <p className="text-xs text-neutral-500 mb-1">{card.descricao}</p>}
                            {card.columnId === "feito" && card.pagoEm && (
                              <p className="text-[11px] text-slate-600 mb-1">PIX enviado em {formatDate(card.pagoEm)}</p>
                            )}
                            {card.precisaComprovante && (
                              <p className="text-[11px] text-red-700 font-medium mb-1">Precisa de comprovante</p>
                            )}
                            <div className="flex items-start justify-between gap-2 mt-1">
                              <p className="text-sm text-neutral-500 min-w-0">
                                Chave Pix:{" "}
                                <span className="font-mono-num text-lg font-bold text-neutral-900 break-all">{card.chavePix}</span>
                              </p>
                              <button
                                onClick={() => copyPix(card.id, card.chavePix)}
                                aria-label="Copiar chave Pix"
                                className="flex-shrink-0 -m-1.5 p-1.5 md:m-0 md:p-0 md:mt-0.5 text-neutral-400 hover:text-neutral-700"
                              >
                                {copiedId === card.id ? <Icon name="check" size={18} className="md:w-3.5 md:h-3.5" /> : <Icon name="copy" size={18} className="md:w-3.5 md:h-3.5" />}
                              </button>
                            </div>
                            <p className={`font-mono-num text-lg font-medium ${col.classes.cardAccent} mt-1`}>{formatMoney(card.valor)}</p>
                            <div className="flex items-center justify-end gap-1 md:gap-3 mt-1.5">
                              {canEdit(card) && (
                                <button
                                  onClick={() => startEdit(card)}
                                  className="text-sm md:text-[11px] px-2 py-1.5 md:p-0 text-neutral-500 hover:text-neutral-800 font-medium"
                                >
                                  Editar
                                </button>
                              )}
                              {session.type === "chefe" && (
                                <button onClick={() => setConfirmDeleteId(card.id)} aria-label="Excluir card" className="p-1.5 md:p-0">
                                  <Icon name="trash" size={16} className="md:w-[13px] md:h-[13px] text-neutral-400 hover:text-red-600" />
                                </button>
                              )}
                            </div>
                            {session.type === "chefe" && card.columnId !== "feito" && (
                              <button
                                onClick={() => markAsDone(card.id)}
                                disabled={movingIds.includes(card.id)}
                                className={`w-full mt-2 text-white text-sm md:text-xs font-medium rounded py-2.5 md:py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ${FEITO_COLUMN.classes.btn}`}
                              >
                                {movingIds.includes(card.id) ? (
                                  <>
                                    <Spinner size={13} /> Salvando…
                                  </>
                                ) : (
                                  "Marcar como Feito"
                                )}
                              </button>
                            )}
                            {session.type === "chefe" && card.columnId === "feito" && origem && (
                              <button
                                onClick={() => moveCard(card.id, card.origemId)}
                                disabled={movingIds.includes(card.id)}
                                className={`w-full mt-2 text-sm md:text-xs font-medium rounded py-2.5 md:py-1.5 border flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ${origem.classes.badge}`}
                              >
                                {movingIds.includes(card.id) ? (
                                  <>
                                    <Spinner size={13} /> Salvando…
                                  </>
                                ) : (
                                  `Devolver para ${origem.curto}`
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </>
        );
      })()}

      {page === "report" && session.type === "chefe" && (
        <div className="pb-20">
          {(() => {
            const relevantEmpresas = EMPRESAS;
            const currentMonth = monthKey();
            const selectedMonth = reportMonth === "current" ? currentMonth : reportMonth;
            const empresaCards = cards.filter((c) => relevantEmpresas.some((e) => e.id === c.origemId));
            // Meses que já acabaram e têm PIX: ficam arquivados e só aparecem ao escolher o mês.
            const archivedMonths = [...new Set(empresaCards.map((c) => monthKey(c.createdAt)))]
              .filter((k) => k < currentMonth)
              .sort()
              .reverse();
            const relevantCards = empresaCards
              .filter((c) => selectedMonth === "all" || monthKey(c.createdAt) === selectedMonth)
              .filter(matchesSearch)
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const grandTotal = relevantCards.reduce((sum, c) => sum + Number(c.valor || 0), 0);

            function statusLabel(card) {
              if (card.archived) return { text: "Arquivado", className: "bg-neutral-200 text-neutral-600" };
              if (card.columnId === "feito") return { text: "Feito", className: "bg-slate-200 text-slate-700" };
              return { text: "Pendente", className: "bg-amber-100 text-amber-800" };
            }

            return (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setReportMonth("current")}
                      className={`text-xs rounded-md px-2.5 py-2 sm:py-1.5 border whitespace-nowrap ${
                        selectedMonth === currentMonth
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-white text-neutral-600 border-neutral-300"
                      }`}
                    >
                      {monthLabel(currentMonth)} (atual)
                    </button>
                    <select
                      value={archivedMonths.includes(selectedMonth) ? selectedMonth : ""}
                      onChange={(e) => e.target.value && setReportMonth(e.target.value)}
                      disabled={archivedMonths.length === 0}
                      className={`text-xs rounded-md px-2 py-2 sm:py-1.5 border disabled:opacity-40 ${
                        archivedMonths.includes(selectedMonth)
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-white text-neutral-600 border-neutral-300"
                      }`}
                    >
                      <option value="">Meses arquivados ({archivedMonths.length})</option>
                      {archivedMonths.map((k) => (
                        <option key={k} value={k}>
                          {monthLabel(k)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setReportMonth("all")}
                      className={`text-xs rounded-md px-2.5 py-2 sm:py-1.5 border whitespace-nowrap ${
                        selectedMonth === "all"
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-white text-neutral-600 border-neutral-300"
                      }`}
                    >
                      Todos os meses
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      selectedMonth === "all"
                        ? downloadCsv(relevantCards, "relatorio-pix-todos")
                        : downloadCsv(relevantCards, `relatorio-pix-${selectedMonth}`, false)
                    }
                    disabled={relevantCards.length === 0}
                    className="flex items-center gap-1.5 text-xs rounded-md px-2.5 py-2 sm:py-1.5 border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    <Icon name="download" size={13} /> Exportar CSV
                  </button>
                  <div className="relative ml-auto w-full sm:w-64">
                    <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar favorecido ou chave PIX"
                      className="w-full text-base sm:text-sm border border-neutral-300 rounded-md pl-8 pr-2.5 py-2 sm:py-1.5 bg-white"
                    />
                  </div>
                </div>

                {archivedMonths.includes(selectedMonth) && (
                  <div className="flex items-center justify-between gap-2 mb-3 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                    <span>Mês arquivado: {monthLabel(selectedMonth)}</span>
                    <button onClick={() => setReportMonth("current")} className="text-xs underline text-neutral-600">
                      Voltar ao mês atual
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                  {relevantEmpresas.map((emp) => {
                    const empCards = relevantCards.filter((c) => c.origemId === emp.id);
                    const empTotal = empCards.reduce((sum, c) => sum + Number(c.valor || 0), 0);
                    return (
                      <div key={emp.id} className="bg-white border border-neutral-200 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full ${emp.classes.dot}`} />
                          <p className="text-xs text-neutral-500 leading-tight">{emp.nome}</p>
                        </div>
                        <p className="font-mono-num text-base sm:text-lg font-medium text-neutral-900 break-all">{formatMoney(empTotal)}</p>
                        <p className="text-[11px] text-neutral-400">{empCards.length} PIX</p>
                      </div>
                    );
                  })}
                  <div className="col-span-2 sm:col-span-1 bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-300 mb-1">Total geral</p>
                    <p className="font-mono-num text-lg font-medium text-white break-all">{formatMoney(grandTotal)}</p>
                    <p className="text-[11px] text-neutral-400">{relevantCards.length} PIX</p>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                  {relevantCards.length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-10">
                      {syncFailed && cards.length === 0
                        ? "Não foi possível carregar os PIX."
                        : searchQuery.trim()
                        ? "Nenhum PIX encontrado para essa busca."
                        : selectedMonth === "all"
                        ? "Nenhum PIX registrado ainda."
                        : `Nenhum PIX em ${monthLabel(selectedMonth)}.`}
                    </p>
                  )}
                  {relevantCards.map((card) => {
                    const origem = empresaById(card.origemId);
                    const status = statusLabel(card);
                    return (
                      <div key={card.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-neutral-100 last:border-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {origem && <span className={`w-1.5 h-1.5 rounded-full ${origem.classes.dot}`} />}
                            <p className="text-sm font-medium text-neutral-900 truncate">{card.favorecido}</p>
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            {origem ? origem.nome : ""} · Criado {formatDate(card.createdAt)}
                            {card.pagoEm ? ` · Enviado ${formatDate(card.pagoEm)}` : ""}
                            {card.descricao ? ` · ${card.descricao}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${status.className}`}>{status.text}</span>
                          <span className="font-mono-num text-sm font-medium text-neutral-900">{formatMoney(card.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {page === "activities" && session.type === "chefe" && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden pb-4">
          {activitiesLoading && activities.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-10 flex items-center justify-center gap-2" role="status">
              <Spinner size={14} /> Carregando atividades…
            </p>
          )}
          {activitiesError && (
            <p className="text-sm text-red-700 bg-red-50 border-b border-red-200 text-center px-3 py-3" role="alert">
              {activitiesError}
            </p>
          )}
          {!activitiesLoading && !activitiesError && activities.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-10">Nenhuma atividade registrada ainda.</p>
          )}
          {activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 px-3 sm:px-4 py-2.5 border-b border-neutral-100 last:border-0">
              <span className="mt-0.5 text-neutral-400 flex-shrink-0">
                <Icon name={activityIcon(act.acao)} size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-neutral-800">
                  <span className="font-medium">{act.ator}</span> · {act.detalhe}
                </p>
                <p className="text-[11px] text-neutral-400 font-mono-num">{formatDate(act.em)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {page === "report" && session.type === "chefe" && (
        <button
          onClick={openResetConfirm}
          className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-full px-4 py-2.5 shadow-lg z-40"
        >
          <Icon name="trash" size={14} /> Zerar relatórios
        </button>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full">
            <h2 className="font-display text-lg text-neutral-900 mb-1">Excluir este PIX?</h2>
            <p className="text-sm text-neutral-500 mb-4">Essa ação apaga o card de vez. Não tem como desfazer.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={busy === "delete"}
                className="flex-1 border border-neutral-300 rounded-md py-2.5 sm:py-2 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteCard(confirmDeleteId)}
                disabled={busy === "delete"}
                className="flex-1 bg-red-600 text-white rounded-md py-2.5 sm:py-2 hover:bg-red-700 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
              >
                {busy === "delete" ? (
                  <>
                    <Spinner size={14} /> Excluindo…
                  </>
                ) : (
                  "Excluir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResetReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full">
            <h2 className="font-display text-lg text-neutral-900 mb-1">Zerar todos os relatórios?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Isso apaga TODOS os {cards.length} PIX de todos os estabelecimentos (pendentes, feitos e arquivados) pra sempre. Não tem como desfazer.
            </p>
            <button
              onClick={() => {
                downloadCsv(cards, "backup-pix");
                setResetBackupDone(true);
              }}
              disabled={cards.length === 0 || busy === "reset"}
              className="w-full flex items-center justify-center gap-1.5 border border-neutral-300 rounded-md py-2.5 sm:py-2 mb-2 text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              {resetBackupDone ? <Icon name="check" size={14} /> : <Icon name="download" size={14} />}
              {resetBackupDone ? "Backup baixado" : "1. Baixar backup (CSV)"}
            </button>
            {!resetBackupDone && cards.length > 0 && (
              <p className="text-xs text-neutral-500 mb-3">Baixe o backup antes de zerar.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmResetReport(false)}
                disabled={busy === "reset"}
                className="flex-1 border border-neutral-300 rounded-md py-2.5 sm:py-2 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={resetAllReports}
                disabled={(!resetBackupDone && cards.length > 0) || busy === "reset"}
                className="flex-1 bg-red-600 text-white rounded-md py-2.5 sm:py-2 hover:bg-red-700 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-red-600"
              >
                {busy === "reset" ? (
                  <>
                    <Spinner size={14} /> Zerando…
                  </>
                ) : (
                  "Zerar tudo"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClearFeito && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full">
            <h2 className="font-display text-lg text-neutral-900 mb-1">Arquivar todos os feitos?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Eles saem do quadro, mas continuam guardados no Relatório/Histórico.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClearFeito(false)}
                disabled={busy === "archive"}
                className="flex-1 border border-neutral-300 rounded-md py-2.5 sm:py-2 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={archiveAllDone}
                disabled={busy === "archive"}
                className="flex-1 bg-neutral-900 text-white rounded-md py-2.5 sm:py-2 hover:bg-neutral-800 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
              >
                {busy === "archive" ? (
                  <>
                    <Spinner size={14} /> Arquivando…
                  </>
                ) : (
                  "Arquivar todos"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  // Se o Firebase não carregou (internet caiu ou CDN fora), mostra um aviso em vez de tela branca.
  if (!window.db) {
    return <FalhaTela mensagem="Não foi possível conectar ao servidor. Verifique a internet e recarregue a página." />;
  }
  return <PixBoard />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
