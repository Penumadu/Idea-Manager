import { db, auth } from '../core/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ReactiveProvider } from '../core/reactive';

class IdeaStore extends ReactiveProvider {
  constructor() {
    super({
      ideas: [],
      loading: true,
      error: null,
      currentUser: null
    });

    this.unsubscribe = null;
  }

  init(user) {
    if (this.unsubscribe) this.unsubscribe();
    this.setState({ currentUser: user, loading: true });

    if (!user) {
      const localIdeas = JSON.parse(localStorage.getItem('local_ideas') || '[]');
      this.setState({ ideas: localIdeas, loading: false });
      return;
    }

    let q;
    if (user.email === 'penumadu@gmail.com') {
      // Admin sees all ideas across the platform
      q = query(collection(db, 'ideas'));
    } else {
      // Regular users only see their own ideas
      q = query(
        collection(db, 'ideas'),
        where('author_id', '==', user.uid)
      );
    }

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const ideas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.setState({ ideas, loading: false });
    }, (error) => {
      console.error("Firestore Error:", error);
      this.setState({ error: error.message, loading: false });
    });
  }

  async addIdea(idea) {
    const metadata = {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };

    if (!this.state.currentUser) {
      const newIdea = { ...idea, metadata, id: 'local_' + Date.now() };
      const updatedIdeas = [...this.state.ideas, newIdea];
      localStorage.setItem('local_ideas', JSON.stringify(updatedIdeas));
      this.setState({ ideas: updatedIdeas });
      return newIdea;
    }
    
    return await addDoc(collection(db, 'ideas'), {
      ...idea,
      author_id: this.state.currentUser.uid,
      metadata
    });
  }

  async updateIdea(id, updates) {
    const metadata = { last_updated: new Date().toISOString() };
    
    if (!this.state.currentUser) {
      const updatedIdeas = this.state.ideas.map(i => i.id === id ? { ...i, ...updates, metadata: { ...i.metadata, ...metadata } } : i);
      localStorage.setItem('local_ideas', JSON.stringify(updatedIdeas));
      this.setState({ ideas: updatedIdeas });
      return;
    }

    const ideaRef = doc(db, 'ideas', id);
    return await updateDoc(ideaRef, {
      ...updates,
      'metadata.last_updated': metadata.last_updated
    });
  }

  async deleteIdea(id) {
    if (!this.state.currentUser) {
      const updatedIdeas = this.state.ideas.filter(i => i.id !== id);
      localStorage.setItem('local_ideas', JSON.stringify(updatedIdeas));
      this.setState({ ideas: updatedIdeas });
      return;
    }

    const ideaRef = doc(db, 'ideas', id);
    return await deleteDoc(ideaRef);
  }
}

export const ideaStore = new IdeaStore();
