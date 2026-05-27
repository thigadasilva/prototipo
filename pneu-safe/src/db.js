let db = [];
let idCounter = 1;

export const initDB = async () => {
  try {
    const data = localStorage.getItem('sqlite3_pneusafe');
    if (data) {
      db = JSON.parse(data);
      if (db.length > 0) {
        idCounter = Math.max(...db.map(i => i.id)) + 1;
      }
    } else {
      db = [];
    }
  } catch (err) {
    console.error("Erro ao iniciar DB:", err);
    db = [];
  }
};

export const saveDB = () => {
  try {
    localStorage.setItem('sqlite3_pneusafe', JSON.stringify(db));
  } catch (e) {
    console.error("Falha ao salvar no localStorage", e);
  }
};

export const getInspecoes = () => {
  if (!db) return [];
  // Retorna ordenado do mais recente para o mais antigo
  return [...db].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const addInspecao = (pneu_id, status_final, detalhes_falha) => {
  const novaInspecao = {
    id: idCounter++,
    pneu_id,
    status_final,
    detalhes_falha: JSON.stringify(detalhes_falha),
    timestamp: new Date().toISOString(),
    sincronizado: 0
  };
  
  db.push(novaInspecao);
  saveDB();
};

export const syncInspecoes = async () => {
  // Simula um delay de rede
  await new Promise(r => setTimeout(r, 1000));
  db = db.map(i => ({ ...i, sincronizado: 1 }));
  saveDB();
};
