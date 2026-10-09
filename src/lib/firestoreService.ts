import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import { Repository, PullRequest, Issue, PseudoBuild, ChatMessage, UserSettings } from '../types/index.ts';

// Repositories
export function subscribeRepositories(userId: string, onUpdate: (repos: Repository[]) => void): Unsubscribe {
  const path = 'repositories';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => docSnap.data() as Repository);
        // Sort by updatedAt descending
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveRepository(repo: Repository): Promise<void> {
  const path = `repositories/${repo.id}`;
  try {
    await setDoc(doc(db, 'repositories', repo.id), repo);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateRepository(repoId: string, data: Partial<Repository>): Promise<void> {
  const path = `repositories/${repoId}`;
  try {
    await updateDoc(doc(db, 'repositories', repoId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeRepository(repoId: string): Promise<void> {
  const path = `repositories/${repoId}`;
  try {
    await deleteDoc(doc(db, 'repositories', repoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Pull Requests
export function subscribePullRequests(
  userId: string,
  repoId: string,
  onUpdate: (prs: PullRequest[]) => void
): Unsubscribe {
  const path = 'pull_requests';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const allPrs = snapshot.docs.map((d) => d.data() as PullRequest);
        const filtered = allPrs.filter((p) => p.repoId === repoId);
        filtered.sort((a, b) => b.number - a.number);
        onUpdate(filtered);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function batchSavePullRequests(userId: string, repoId: string, prs: PullRequest[]): Promise<void> {
  for (const pr of prs) {
    const path = `pull_requests/${pr.id}`;
    try {
      await setDoc(doc(db, 'pull_requests', pr.id), pr);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function updatePullRequest(prId: string, data: Partial<PullRequest>): Promise<void> {
  const path = `pull_requests/${prId}`;
  try {
    await updateDoc(doc(db, 'pull_requests', prId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Issues
export function subscribeIssues(
  userId: string,
  repoId: string,
  onUpdate: (issues: Issue[]) => void
): Unsubscribe {
  const path = 'issues';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const allIssues = snapshot.docs.map((d) => d.data() as Issue);
        const filtered = allIssues.filter((i) => i.repoId === repoId);
        filtered.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
        onUpdate(filtered);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function batchSaveIssues(userId: string, repoId: string, issues: Issue[]): Promise<void> {
  for (const iss of issues) {
    const path = `issues/${iss.id}`;
    try {
      await setDoc(doc(db, 'issues', iss.id), iss);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

// Pseudo Builds
export function subscribePseudoBuilds(
  userId: string,
  repoId: string,
  onUpdate: (builds: PseudoBuild[]) => void
): Unsubscribe {
  const path = 'pseudo_builds';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const all = snapshot.docs.map((d) => d.data() as PseudoBuild);
        const filtered = all.filter((b) => b.repoId === repoId);
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(filtered);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function savePseudoBuild(build: PseudoBuild): Promise<void> {
  const path = `pseudo_builds/${build.id}`;
  try {
    await setDoc(doc(db, 'pseudo_builds', build.id), build);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePseudoBuild(buildId: string): Promise<void> {
  const path = `pseudo_builds/${buildId}`;
  try {
    await deleteDoc(doc(db, 'pseudo_builds', buildId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Chat Messages
export function subscribeChatMessages(userId: string, onUpdate: (msgs: ChatMessage[]) => void): Unsubscribe {
  const path = 'chat_messages';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as ChatMessage);
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        onUpdate(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const path = `chat_messages/${msg.id}`;
  try {
    await setDoc(doc(db, 'chat_messages', msg.id), msg);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearChatMessages(userId: string): Promise<void> {
  const path = 'chat_messages';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, path, d.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// User Settings
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const path = `settings/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'settings', userId));
    if (snap.exists()) {
      return snap.data() as UserSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const path = `settings/${settings.id}`;
  try {
    await setDoc(doc(db, 'settings', settings.id), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
