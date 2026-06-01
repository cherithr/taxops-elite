import {
  collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch,
  query, orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── COLLECTION REFS ────────────────────────────────────────────────────────
export const COLS = {
  projects: "projects",
  tasks:    "tasks",
  team:     "team",
  states:   "states",
  audits:   "audits",
  refunds:  "refunds",
};

// ─── REAL-TIME LISTENER (returns unsubscribe fn) ────────────────────────────
export const subscribe = (colName, setState, orderField = "createdAt") => {
  const q = query(collection(db, colName), orderBy(orderField, "asc"));
  return onSnapshot(
    q,
    snap => setState(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => console.error(`[subscribe:${colName}]`, err.code, err.message) // ← ADD THIS
  );
};

// ─── CREATE ─────────────────────────────────────────────────────────────────
export const createDoc = (colName, data) =>
  addDoc(collection(db, colName), { ...data, createdAt: serverTimestamp() });

// ─── UPDATE ─────────────────────────────────────────────────────────────────
export const updateDocById = (colName, id, data) =>
  updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() });

// ─── DELETE ─────────────────────────────────────────────────────────────────
export const deleteDocById = (colName, id) =>
  deleteDoc(doc(db, colName, id));

// ─── SEED (run once to populate Firestore from static data) ─────────────────
export const seedCollection = async (colName, rows) => {
  const snap = await getDocs(collection(db, colName));
  if (!snap.empty) return; // already seeded
  const batch = writeBatch(db);
  rows.forEach(row => {
    const ref = doc(collection(db, colName));
    batch.set(ref, { ...row, createdAt: serverTimestamp() });
  });
  await batch.commit();
  console.log(`✅ Seeded ${colName}`);
};
