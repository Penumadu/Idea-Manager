import { auth, login, logout } from './core/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ideaStore } from './store/IdeaStore';
import { IdeaDashboard } from './components/IdeaDashboard.ag';
import { IdeaForm } from './components/IdeaForm.ag';
import { BlueprintView } from './components/BlueprintView.ag';
import { PlanEditor } from './components/PlanEditor.ag';
import { IdeaCard } from './components/IdeaCard.ag';

let autoSaveTimeout = null;

const authContainer = document.getElementById('auth-container');
const dashboardView = document.getElementById('dashboard-view');
const editorView = document.getElementById('editor-view');

window.appState = {
  sortBy: 'date_desc', // date_desc, date_asc, name_asc, name_desc
  filterCategory: 'All',
  searchQuery: ''
};

window.toast = {
  show: (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toastEl.innerHTML = `
      <span style="font-weight: bold; font-size: 1.1rem;">${icon}</span>
      <span>${message}</span>
    `;
    
    container.appendChild(toastEl);
    
    // Animate in
    setTimeout(() => toastEl.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 300);
    }, 3000);
  }
};

window.app = {
  viewBlueprint: (id) => {
    const idea = ideaStore.state.ideas.find(i => i.id === id);
    if (idea) {
      dashboardView.style.display = 'none';
      editorView.innerHTML = BlueprintView(idea);
      editorView.style.display = 'block';
    }
  },
  showDashboard: () => {
    editorView.style.display = 'none';
    dashboardView.style.display = 'block';
    editorView.innerHTML = '';
  },
  showNewIdeaForm: () => {
    const modal = document.createElement('div');
    modal.id = 'modal-container';
    modal.innerHTML = IdeaForm();
    document.body.appendChild(modal);
    
    // Add backdrop click to close
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if(e.target.id === 'idea-form-modal') window.app.closeModal();
    });
  },
  closeModal: () => {
    const modal = document.getElementById('modal-container');
    if (modal) modal.remove();
  },
  editPlan: (id) => {
    const idea = ideaStore.state.ideas.find(i => i.id === id);
    const modal = document.createElement('div');
    modal.id = 'plan-modal-container';
    modal.innerHTML = PlanEditor(idea);
    document.body.appendChild(modal);
    
    // Add backdrop click to close
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if(e.target.id === 'plan-editor-modal') window.app.closePlanEditor(id);
    });
  },
  closePlanEditor: (id) => {
    const modal = document.getElementById('plan-modal-container');
    if (modal) modal.remove();
    // Refresh blueprint view to show saved changes
    window.app.viewBlueprint(id);
  },
  addPhase: (id) => {
    const idea = ideaStore.state.ideas.find(i => i.id === id);
    if (!idea.development_plan) idea.development_plan = { phases: [], benefits: '', complexity: 'Medium' };
    idea.development_plan.phases.push({ title: '', tasks: [] });
    document.getElementById('plan-modal-container').innerHTML = PlanEditor(idea);
    window.app.autoSavePlan(id);
  },
  removePhase: (id, index) => {
    const idea = ideaStore.state.ideas.find(i => i.id === id);
    idea.development_plan.phases.splice(index, 1);
    document.getElementById('plan-modal-container').innerHTML = PlanEditor(idea);
    window.app.autoSavePlan(id);
  },
  autoSavePlan: (id) => {
    const status = document.getElementById('save-status');
    if (status) {
      status.innerHTML = 'Saving...';
      status.classList.add('saving');
    }
    
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
      const complexity = document.getElementById('plan-complexity').value;
      const benefits = document.getElementById('plan-benefits').value;
      const phaseItems = document.querySelectorAll('.phase-edit-item');
      
      const phases = Array.from(phaseItems).map(item => ({
        title: item.querySelector('.phase-title').value,
        tasks: item.querySelector('.phase-tasks').value.split('\n').filter(t => t.trim() !== '')
      }));

      const development_plan = { complexity, benefits, phases };
      
      try {
        await ideaStore.updateIdea(id, { development_plan });
        if (status) {
          status.innerHTML = 'All changes saved';
          status.classList.remove('saving');
        }
        
        // Update local state immediately so UI re-renders don't lose focus state if we were to re-render
        const idea = ideaStore.state.ideas.find(i => i.id === id);
        if(idea) idea.development_plan = development_plan;

      } catch (e) {
        if (status) {
          status.innerText = 'Error saving';
          status.classList.remove('saving');
        }
        window.toast.show('Failed to save plan', 'error');
      }
    }, 1000); // 1s debounce
  },
  editIdea: (id) => {
    const idea = ideaStore.state.ideas.find(i => i.id === id);
    const modal = document.createElement('div');
    modal.id = 'modal-container';
    modal.innerHTML = IdeaForm(idea);
    document.body.appendChild(modal);
    
    // Add backdrop click to close
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if(e.target.id === 'idea-form-modal') window.app.closeModal();
    });
  },
  deleteIdea: async (id) => {
    const currentUser = ideaStore.state.currentUser;
    if (!currentUser || currentUser.email !== 'penumadu@gmail.com') {
      window.toast.show("Only penumadu@gmail.com can delete ideas.", 'error');
      return;
    }
    if (confirm("Are you sure you want to delete this idea?")) {
      try {
        await ideaStore.deleteIdea(id);
        window.toast.show("Idea deleted successfully", 'success');
        window.app.showDashboard();
      } catch (error) {
        window.toast.show("Failed to delete idea", 'error');
      }
    }
  },
  
  // New unified sort/filter function
  applySortAndFilter: () => {
    const grid = document.getElementById('ideas-grid');
    if (!grid) return;
    
    let filtered = [...ideaStore.state.ideas];
    
    // Apply search filter
    if (window.appState.searchQuery) {
      const q = window.appState.searchQuery.toLowerCase();
      filtered = filtered.filter(idea => 
        idea.title.toLowerCase().includes(q) ||
        idea.category.toLowerCase().includes(q) ||
        (idea.tech_stack && idea.tech_stack.some(t => t.toLowerCase().includes(q)))
      );
    }
    
    // Apply category filter
    if (window.appState.filterCategory !== 'All') {
      filtered = filtered.filter(idea => idea.category === window.appState.filterCategory);
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      if (window.appState.sortBy === 'name_asc') {
        return a.title.localeCompare(b.title);
      } else if (window.appState.sortBy === 'name_desc') {
        return b.title.localeCompare(a.title);
      } else if (window.appState.sortBy === 'date_asc') {
        return new Date(a.metadata?.created_at || 0) - new Date(b.metadata?.created_at || 0);
      } else {
        // default: date_desc
        return new Date(b.metadata?.created_at || 0) - new Date(a.metadata?.created_at || 0);
      }
    });
    
    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1" class="empty-state"><p>No ideas match your filters.</p></div>`;
    } else {
      grid.innerHTML = filtered.map(idea => IdeaCard(idea, ideaStore.state.currentUser)).join('');
    }
  },
  
  filterIdeas: (query) => {
    window.appState.searchQuery = query;
    window.app.applySortAndFilter();
  },
  
  sortIdeas: (sortType) => {
    window.appState.sortBy = sortType;
    window.app.applySortAndFilter();
  },
  
  filterByCategory: (category) => {
    window.appState.filterCategory = category;
    window.app.applySortAndFilter();
  },

  handleFormSubmit: async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const id = formData.get('id');
    const ideaData = {
      title: formData.get('title'),
      category: formData.get('category'),
      description: formData.get('description'),
      tech_stack: formData.get('tech_stack').split(',').map(s => s.trim()).filter(s => s !== '')
    };

    try {
      if (id) {
        await ideaStore.updateIdea(id, ideaData);
        window.toast.show("Idea updated successfully", 'success');
      } else {
        await ideaStore.addIdea(ideaData);
        window.toast.show("New idea captured!", 'success');
      }
      window.app.closeModal();
      // If we were in blueprint view, refresh it
      if (id && document.getElementById('editor-view').style.display !== 'none') {
        window.app.viewBlueprint(id);
      } else {
        // Otherwise make sure we're on dashboard and sorted
        window.app.showDashboard();
      }
    } catch (error) {
      window.toast.show("Error saving idea: " + error.message, 'error');
    }
  }
};

// Global Escape Key Listener for Modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const formModal = document.getElementById('modal-container');
    const planModal = document.getElementById('plan-modal-container');
    
    if (formModal) window.app.closeModal();
    else if (planModal) {
      // Find the ID of the current plan being edited and close it
      // since the modal wrapper just has 'plan-modal-container' id
      // A simpler approach is just remove the modal entirely
      planModal.remove();
      // Refresh blueprint view via the app method but we need the ID, 
      // let's grab it from the URL or state if we can, else just hide modal
      // This is slightly hacky but works for now
      const btn = planModal.querySelector('.btn-close');
      if (btn) btn.click();
    }
  }
});

function renderAuth() {
  const user = auth.currentUser;
  if (user) {
    authContainer.innerHTML = `
      <div class="user-profile">
        <span>${user.displayName}</span>
        <button id="logout-btn" class="btn">Logout</button>
      </div>
    `;
    document.getElementById('logout-btn').onclick = logout;
  } else {
    authContainer.innerHTML = `
      <button id="login-btn" class="btn btn-primary">Login with Google</button>
    `;
    document.getElementById('login-btn').onclick = login;
  }
}

onAuthStateChanged(auth, (user) => {
  renderAuth();
  ideaStore.init(user);
});

ideaStore.subscribe((state) => {
  dashboardView.innerHTML = IdeaDashboard(state);
  // Apply current sorts/filters after render
  if (!state.loading && !state.error && state.ideas.length > 0) {
    window.app.applySortAndFilter();
  }
});

// Initial Render
renderAuth();
