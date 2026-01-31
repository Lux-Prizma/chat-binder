/**
 * Main Application - Orchestrates all modules
 */

import { eventBus } from './core/EventBus.js';
import { HtmlUtils } from './utils/HtmlUtils.js';
import { MessageRenderer } from './features/MessageRenderer.js';
import { QuestionNavigator } from './features/QuestionNavigator.js';
import { DateFilter } from './features/DateFilter.js';
import { FolderManager } from './features/FolderManager.js';
import { ContextMenu } from './features/ContextMenu.js';
import { ConversationList } from './features/ConversationList.js';

class ChatGPTParserApp {
    constructor() {
        this.data = chatData;
        this.currentView = 'upload';
        this.searchResults = [];
        this.currentSort = 'newestCreated';
        this.highlightedPairId = null;

        // Initialize features
        this.messageRenderer = new MessageRenderer(eventBus, this.data);
        this.questionNavigator = new QuestionNavigator(eventBus);
        this.contextMenu = new ContextMenu(eventBus, this.data, () => this.updateConversationList());
        this.conversationList = new ConversationList(eventBus, this.data, this.contextMenu);

        // Date filter and folder manager need callbacks
        this.dateFilter = new DateFilter(eventBus, this.data, () => this.updateConversationList());
        this.folderManager = new FolderManager(eventBus, this.data, () => this.updateConversationList());

        this.init();
    }

    init() {
        this.bindEvents();
        this.initAsync();
    }

    async initAsync() {
        await this.data.loadFromStorage();
        this.currentSort = this.data.currentSort || 'newestCreated';
        document.getElementById('sortSelect').value = this.currentSort;
        this.updateUI();
    }

    bindEvents() {
        // Top navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.openTab(tabName, tab);
            });
        });

        // File upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        document.getElementById('newChatBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // Sort control
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.updateConversationList();
        });

        // Folder headers
        document.querySelectorAll('.folder-header[data-folder]').forEach(header => {
            header.addEventListener('click', (e) => {
                const folderId = header.dataset.folder;
                this.toggleFolder(folderId);
            });
        });

        // Global search
        document.getElementById('globalSearchInput').addEventListener('input', (e) => {
            this.handleGlobalSearch(e.target.value);
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Edit thread title
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.toggleTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('blur', () => {
            this.saveTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTitleEdit();
            }
        });

        // Delete thread
        document.getElementById('deleteThreadBtn').addEventListener('click', () => {
            this.deleteCurrentThread();
        });

        // Thread search - connect to MessageRenderer via EventBus
        document.getElementById('threadSearchInput').addEventListener('input', (e) => {
            eventBus.emit('search:query', { query: e.target.value });
        });

        document.getElementById('threadSearchInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                eventBus.emit('search:next');
            }
        });

        document.getElementById('searchNextBtn').addEventListener('click', () => {
            eventBus.emit('search:next');
        });

        document.getElementById('searchPrevBtn').addEventListener('click', () => {
            eventBus.emit('search:prev');
        });

        document.getElementById('searchCloseBtn').addEventListener('click', () => {
            eventBus.emit('search:clear');
        });

        // Save project
        document.getElementById('saveProjectBtn').addEventListener('click', () => {
            this.saveProject();
        });

        // Clear data
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                this.clearAllData();
            }
        });

        // Setup event bus listeners for inter-module communication
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        // Conversation selection
        eventBus.on('conversation:select', async (data) => {
            await this.selectConversation(data.id);
        });

        eventBus.on('conversation:selectWithPair', (data) => {
            this.selectConversationWithHighlightedPair(data.conversationId, data.pairId);
        });

        eventBus.on('conversation:star', async (data) => {
            await this.toggleStarConversation(data.id);
        });

        // Message actions
        eventBus.on('pair:delete', async (data) => {
            if (this.data.currentConversationId && confirm('Delete this message pair? This cannot be undone.')) {
                await this.data.deletePair(this.data.currentConversationId, data.pairId);
                this.updateMainView();
            }
        });

        eventBus.on('pair:star', async (data) => {
            if (this.data.currentConversationId) {
                await this.data.toggleStarPair(this.data.currentConversationId, data.pairId);
                this.updateMainView();
            }
        });
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const totalConversations = [];
        const allWarnings = [];

        for (const file of files) {
            try {
                const content = await file.text();
                let conversations = [];
                let warnings = [];

                if (file.name.endsWith('.json')) {
                    const jsonData = JSON.parse(content);
                    const result = this.data.parseJSONExport(jsonData);
                    conversations = result.conversations;
                    warnings = result.warnings;
                } else if (file.name.endsWith('.html')) {
                    conversations = this.data.parseHTMLExport(content);
                }

                totalConversations.push(...conversations);
                allWarnings.push(...warnings);
            } catch (error) {
                console.error('Error parsing file', file.name, ':', error);
                alert(`Error parsing file: ${file.name}\n\n${error.message}`);
            }
        }

        if (allWarnings.length > 0) {
            console.warn('Import warnings:', allWarnings);
        }

        if (totalConversations.length > 0) {
            await this.data.addConversations(totalConversations);
            alert(`Successfully imported ${totalConversations.length} conversation(s)!`);
            this.updateUI();
        } else {
            alert('No valid conversations found in the uploaded file(s).');
        }

        document.getElementById('fileInput').value = '';
    }

    toggleFolder(folderId) {
        const folder = document.querySelector(`.folder-header[data-folder="${folderId}"]`);
        const content = document.getElementById(`${folderId}Content`);
        const arrow = folder.querySelector('.folder-arrow');

        if (!folder || !content || !arrow) return;

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            arrow.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            arrow.classList.add('collapsed');
        }
    }

    handleGlobalSearch(query) {
        this.updateConversationList();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    toggleTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = !input.disabled;
        if (!input.disabled) {
            input.focus();
            input.select();
        }
    }

    async saveTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = true;

        if (this.data.currentConversationId) {
            const newTitle = input.value.trim();
            if (newTitle) {
                await this.data.updateConversationTitle(this.data.currentConversationId, newTitle);
                this.updateConversationList();
            }
        }
    }

    async deleteCurrentThread() {
        if (!this.data.currentConversationId) return;

        if (confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) {
            await this.data.deleteConversation(this.data.currentConversationId);
            this.updateUI();
        }
    }

    saveProject() {
        const project = this.data.exportProject();
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatgpt-parser-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async clearAllData() {
        await this.data.clearStorage();
        this.data.conversations = [];
        this.data.currentConversationId = null;
        this.updateUI();
    }

    updateUI() {
        this.updateConversationList();
        this.updateMainView();
    }

    sortConversations(conversations) {
        const sorted = [...conversations];

        switch (this.currentSort) {
            case 'newestCreated':
                sorted.sort((a, b) => b.createTime - a.createTime);
                break;
            case 'oldestCreated':
                sorted.sort((a, b) => a.createTime - b.createTime);
                break;
            case 'recentlyUpdated':
                sorted.sort((a, b) => b.updateTime - a.updateTime);
                break;
            case 'alphabetical':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }

        return sorted;
    }

    updateConversationList() {
        let allConversations = this.data.conversations;
        const starredConversations = allConversations.filter(conv => conv.starred);
        const allStarredPairs = this.data.getStarredPairs();

        const searchQuery = document.getElementById('globalSearchInput').value.trim();

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            allConversations = allConversations.filter(conv => {
                if (conv.title.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
                return conv.pairs.some(pair =>
                    pair.question.content.toLowerCase().includes(lowerQuery) ||
                    pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
                );
            });
        }

        // Apply date filter if active
        if (this.dateFilter.filter.active) {
            allConversations = allConversations.filter(conv => this.dateFilter.matches(conv));
        }

        const sortedAll = this.sortConversations(allConversations);
        const sortedStarred = this.sortConversations(starredConversations);

        // Use ConversationList module to render
        this.conversationList.render(sortedAll, sortedStarred, allStarredPairs);
    }

    async selectConversation(id) {
        this.data.currentConversationId = id;
        await this.data.saveToStorage();
        this.updateUI();
        eventBus.emit('search:clear');

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    selectConversationWithHighlightedPair(conversationId, pairId) {
        this.data.currentConversationId = conversationId;
        this.highlightedPairId = pairId;
        this.messageRenderer.highlightedPairId = pairId;
        this.updateUI();
        eventBus.emit('search:clear');

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    async toggleStarConversation(id) {
        await this.data.toggleStarConversation(id);
        this.updateConversationList();
    }

    updateMainView() {
        const uploadState = document.getElementById('uploadState');
        const chatView = document.getElementById('chatView');

        if (!this.data.currentConversationId) {
            uploadState.style.display = 'flex';
            chatView.style.display = 'none';
            this.currentView = 'upload';
            return;
        }

        uploadState.style.display = 'none';
        chatView.style.display = 'flex';
        this.currentView = 'chat';

        const conv = this.data.getCurrentConversation();
        if (conv) {
            document.getElementById('threadTitleInput').value = conv.title;
            this.messageRenderer.highlightedPairId = this.highlightedPairId;
            this.messageRenderer.renderPairs(conv.pairs);

            // Use QuestionNavigator module to populate dropdown and setup scroll observer
            this.questionNavigator.populate(conv.pairs);

            // Scroll to highlighted pair if set
            if (this.highlightedPairId) {
                const scrollToPair = (attempt = 0) => {
                    const highlightedPair = document.querySelector(`.pair-container[data-pair-id="${this.highlightedPairId}"]`);
                    if (highlightedPair) {
                        highlightedPair.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        this.highlightedPairId = null;
                        this.messageRenderer.highlightedPairId = null;
                    } else if (attempt < 10) {
                        setTimeout(() => scrollToPair(attempt + 1), 100);
                    } else {
                        this.highlightedPairId = null;
                        this.messageRenderer.highlightedPairId = null;
                    }
                };
                setTimeout(() => scrollToPair(), 200);
            }
        }
    }

    openTab(tabName, tabElement) {
        this.closeTabPanel();
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (tabElement) {
            tabElement.classList.add('active');
        }

        const panel = document.getElementById(`${tabName}-panel`);
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    closeTabPanel() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatGPTParserApp();
});
