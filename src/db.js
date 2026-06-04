import {
  collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch,
  query, where,
} from "firebase/firestore";

// 1. Import 'db' AND 'auth' so we know who is logged in
import { db, auth } from "./firebase"; 

// 2. Export 'db' so App.jsx can still access it
export { db };

// ─── COLLECTION REFS ────────────────────────────────────────────────────────
export const COLS = {
  projects: "projects",
  tasks:    "tasks",
  team:     "team",
  states:   "states",
  audits:   "audits",
  refunds:  "refunds",
};

// ─── REAL-TIME LISTENER (Private to the user) ───────────────────────────────
export const subscribe = (colName, userId, setState) => {
  if (!userId) return () => {}; // Do nothing if not logged in

  // Filter the database to ONLY get this user's data
  const q = query(
    collection(db, colName), 
    where("userId", "==", userId)
  );
  
  return onSnapshot(
    q,
    snap => setState(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => console.error(`[subscribe:${colName}]`, err.code, err.message)
  );
};

// ─── CREATE (Stamps the document with the user's ID) ────────────────────────
export const createDoc = async (colName, data) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in to create data");

  // Attach the userId to the payload
  return addDoc(collection(db, colName), { 
    ...data, 
    userId: user.uid,
    createdAt: serverTimestamp() 
  });
};

// ─── UPDATE ─────────────────────────────────────────────────────────────────
export const updateDocById = (colName, id, data) =>
  updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() });

// ─── DELETE ─────────────────────────────────────────────────────────────────
export const deleteDocById = (colName, id) =>
  deleteDoc(doc(db, colName, id));

// ─── SEED (Only seeds data for the specific new user) ───────────────────────
export const seedCollection = async (colName, rows) => {
  const user = auth.currentUser;
  if (!user) return;

  // Check if THIS specific user already has data
  const q = query(collection(db, colName), where("userId", "==", user.uid));
  const snap = await getDocs(q);
  
  if (!snap.empty) return; // already seeded for this user

  const batch = writeBatch(db);
  rows.forEach(row => {
    const ref = doc(collection(db, colName));
    // Seeded data gets assigned to this specific user
    batch.set(ref, { ...row, userId: user.uid, createdAt: serverTimestamp() });
  });
  await batch.commit();
  console.log(`✅ Seeded ${colName} for user ${user.uid}`);
};
