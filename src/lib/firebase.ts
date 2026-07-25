import { DEFAULT_BARBERS, DEFAULT_SERVICES, DEFAULT_APPOINTMENTS, DEFAULT_GALLERY_SETTINGS } from '../data/initialData';

// Standalone In-Memory Data Store (Replaces Firebase completely)
const inMemoryData: Record<string, Record<string, any>> = {
  barbers: {
    'barber-1': { id: 'barber-1', ...DEFAULT_BARBERS[0] },
    'barber-2': { id: 'barber-2', ...DEFAULT_BARBERS[1] },
    'barber-3': { id: 'barber-3', ...DEFAULT_BARBERS[2] },
  },
  services: {
    's1': { id: 's1', ...DEFAULT_SERVICES[0] },
    's2': { id: 's2', ...DEFAULT_SERVICES[1] },
    's3': { id: 's3', ...DEFAULT_SERVICES[2] },
    's4': { id: 's4', ...DEFAULT_SERVICES[3] },
    's5': { id: 's5', ...DEFAULT_SERVICES[4] },
    's6': { id: 's6', ...DEFAULT_SERVICES[5] },
  },
  appointments: DEFAULT_APPOINTMENTS.reduce((acc, apt) => {
    acc[apt.id] = apt;
    return acc;
  }, {} as Record<string, any>),
  settings: {
    tenant: { id: 'tenant', name: 'Barba & Estilo', status: 'active', isFrozen: false, managerEmails: ['jeanmarceloop@gmail.com'] },
    gallery: { id: 'gallery', ...DEFAULT_GALLERY_SETTINGS },
  },
  notifications: {},
  support_tickets: {},
  users: {
    'demo-user-123': {
      uid: 'demo-user-123',
      name: 'Cliente Demo',
      email: 'cliente@kauanbarber.com',
      role: 'client',
      createdAt: new Date().toISOString(),
    },
  },
};

const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export const db = {};
export const auth = { currentUser: null };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  console.error('In-memory Store Error:', error);
  throw new Error(String(error));
}

export interface Ref {
  type: 'doc' | 'collection';
  path: string;
  collectionName: string;
  docId?: string;
}

export function collection(...args: any[]): Ref {
  const parts: string[] = [];
  args.forEach((arg) => {
    if (typeof arg === 'string') {
      parts.push(...arg.split('/'));
    } else if (arg && typeof arg === 'object' && arg.path) {
      parts.push(...String(arg.path).split('/'));
    }
  });
  const cleanParts = parts.filter(Boolean);
  const fullPath = cleanParts.join('/');
  return { type: 'collection', path: fullPath, collectionName: cleanParts[0] || 'default' };
}

export function doc(...args: any[]): Ref {
  const parts: string[] = [];
  args.forEach((arg) => {
    if (typeof arg === 'string') {
      parts.push(...arg.split('/'));
    } else if (arg && typeof arg === 'object' && arg.path) {
      parts.push(...String(arg.path).split('/'));
    }
  });

  const cleanParts = parts.filter(Boolean);
  const fullPath = cleanParts.join('/');

  if (cleanParts.length === 1) {
    return { type: 'collection', path: fullPath, collectionName: cleanParts[0] };
  }
  if (cleanParts.length === 2) {
    return { type: 'doc', path: fullPath, collectionName: cleanParts[0], docId: cleanParts[1] };
  }
  return { type: 'doc', path: fullPath, collectionName: cleanParts[0], docId: cleanParts.slice(1).join('/') };
}

export function query(collRef: Ref, ..._constraints: any[]): Ref {
  return collRef;
}

export function where(_field: string, _op: string, _value: any) {
  return {};
}

export function orderBy(_field: string, _dir?: string) {
  return {};
}

export function serverTimestamp(..._args: any[]) {
  return new Date().toISOString();
}

export function deleteField() {
  return undefined;
}

export function onSnapshot(ref: Ref, callback: (snap: any) => void, _errorCb?: any, _completionCb?: any) {
  const update = () => {
    if (!ref) return;
    if (ref.type === 'doc') {
      const collection = inMemoryData[ref.collectionName] || {};
      const data = ref.docId ? collection[ref.docId] : undefined;
      callback({
        exists: () => data !== undefined,
        data: () => data,
        id: ref.docId,
      });
    } else {
      const collection = inMemoryData[ref.collectionName] || {};
      const docs = Object.keys(collection).map((id) => ({
        id,
        data: () => collection[id],
      }));
      callback({
        docs,
        empty: docs.length === 0,
        forEach: (fn: any) => docs.forEach((d) => fn(d)),
      });
    }
  };

  listeners.add(update);
  update();

  return () => {
    listeners.delete(update);
  };
}

export async function addDoc(ref: Ref, data: any) {
  const collectionName = ref.collectionName;
  if (!inMemoryData[collectionName]) {
    inMemoryData[collectionName] = {};
  }
  const id = 'mock-' + Math.random().toString(36).substring(2, 9);
  const newItem = { id, ...data };
  inMemoryData[collectionName][id] = newItem;
  notifyListeners();
  return { id };
}

export async function setDoc(ref: Ref, data: any, options?: { merge?: boolean }) {
  if (ref.collectionName && ref.docId) {
    if (!inMemoryData[ref.collectionName]) {
      inMemoryData[ref.collectionName] = {};
    }
    const existing = inMemoryData[ref.collectionName][ref.docId] || {};
    inMemoryData[ref.collectionName][ref.docId] = options?.merge
      ? { ...existing, ...data }
      : { id: ref.docId, ...data };
    notifyListeners();
  }
}

export async function updateDoc(ref: Ref, data: any) {
  if (ref.collectionName && ref.docId) {
    const existing = inMemoryData[ref.collectionName]?.[ref.docId] || {};
    inMemoryData[ref.collectionName][ref.docId] = { ...existing, ...data };
    notifyListeners();
  }
}

export async function deleteDoc(ref: Ref) {
  if (ref.collectionName && ref.docId && inMemoryData[ref.collectionName]) {
    delete inMemoryData[ref.collectionName][ref.docId];
    notifyListeners();
  }
}

export async function getDoc(ref: Ref) {
  const collection = inMemoryData[ref.collectionName] || {};
  const data = ref.docId ? collection[ref.docId] : undefined;
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: ref.docId,
  };
}

export async function getDocs(ref: Ref) {
  const collection = inMemoryData[ref.collectionName] || {};
  const docs = Object.keys(collection).map((id) => ({
    id,
    data: () => collection[id],
  }));
  return {
    docs,
    empty: docs.length === 0,
    forEach: (fn: any) => docs.forEach((d) => fn(d)),
  };
}
