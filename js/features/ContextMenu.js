/**
 * ContextMenu - Handles right-click context menus for conversations and folders
 */

import { HtmlUtils } from '../utils/HtmlUtils.js';

export class ContextMenu {
    constructor(eventBus, data, onConversationChange) {
        this.eventBus = eventBus;
        this.data = data;
        this.onConversationChange = onConversationChange;
        this.setupEventListeners();
        this.setupGlobalClickHandler();
    }

    setupEventListeners() {
        // Conversation context menu
        const conversationContextMenu = document.getElementById('conversationContextMenu');
        conversationContextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'move') {
                this.showMoveToSubmenu(e.target);
            }
        });

        // Folder context menu
        const folderContextMenu = document.getElementById('folderContextMenu');
        folderContextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const folderId = folderContextMenu.dataset.folderId;
            if (action === 'rename') {
                this.renameFolder(folderId);
            } else if (action === 'color') {
                this.showColorSubmenu(e.target, folderId);
            } else if (action === 'delete') {
                this.deleteFolder(folderId);
            }
        });

        // Move to submenu
        const moveToSubmenu = document.getElementById('moveToSubmenu');
        moveToSubmenu.addEventListener('click', (e) => {
            const folderId = e.target.dataset.folder;
            if (folderId !== undefined) {
                this.moveConversationToFolder(folderId);
            }
        });

        // Color submenu
        const colorSubmenu = document.getElementById('colorSubmenu');
        colorSubmenu.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            if (color) {
                const folderId = colorSubmenu.dataset.folderId;
                this.selectFolderColor(folderId, color);
            }
        });
    }

    setupGlobalClickHandler() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideAll();
            }
        });
    }

    hideAll() {
        document.getElementById('conversationContextMenu').style.display = 'none';
        document.getElementById('folderContextMenu').style.display = 'none';
        document.getElementById('moveToSubmenu').style.display = 'none';
        document.getElementById('colorSubmenu').style.display = 'none';
    }

    showConversationContextMenu(event, conversationId) {
        event.preventDefault();
        event.stopPropagation();
        this.hideAll();

        const menu = document.getElementById('conversationContextMenu');
        menu.dataset.conversationId = conversationId;
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.display = 'block';
    }

    showFolderContextMenu(event, folderId) {
        event.preventDefault();
        event.stopPropagation();
        this.hideAll();

        const menu = document.getElementById('folderContextMenu');
        menu.dataset.folderId = folderId;
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.display = 'block';
    }

    showMoveToSubmenu(menuItem) {
        const submenu = document.getElementById('moveToSubmenu');
        const rect = menuItem.getBoundingClientRect();

        // Build folder list
        let folderOptions = '<div class="context-menu-item" data-folder="all">📁 All Conversations</div>';

        this.data.folders.forEach(folder => {
            folderOptions += `<div class="context-menu-item" data-folder="${folder.id}">
                <span class="folder-color-dot" style="background-color: ${folder.color}"></span>
                ${HtmlUtils.escapeHtml(folder.name)}
            </div>`;
        });

        submenu.innerHTML = folderOptions;
        submenu.style.left = `${rect.right}px`;
        submenu.style.top = `${rect.top}px`;
        submenu.style.display = 'block';

        // Store conversation ID for move operation
        submenu.dataset.conversationId = document.getElementById('conversationContextMenu').dataset.conversationId;
    }

    async moveConversationToFolder(folderId) {
        const conversationId = document.getElementById('moveToSubmenu').dataset.conversationId;
        if (!conversationId) return;

        await this.data.moveConversationToFolder(conversationId, folderId === 'all' ? null : folderId);
        this.hideAll();
        if (this.onConversationChange) {
            this.onConversationChange();
        }
    }

    showColorSubmenu(menuItem, folderId) {
        const submenu = document.getElementById('colorSubmenu');
        const rect = menuItem.getBoundingClientRect();

        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
        const colorNames = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Gray'];

        let colorOptions = '';
        colors.forEach((color, index) => {
            colorOptions += `<div class="color-option" data-color="${color}" style="background-color: ${color};" title="${colorNames[index]}"></div>`;
        });

        submenu.innerHTML = colorOptions;
        submenu.style.left = `${rect.right}px`;
        submenu.style.top = `${rect.top}px`;
        submenu.style.display = 'block';
        submenu.dataset.folderId = folderId;
    }

    async selectFolderColor(folderId, color) {
        await this.data.updateFolder(folderId, { color });
        this.hideAll();
        if (this.onConversationChange) {
            this.onConversationChange();
        }
    }

    renameFolder(folderId) {
        const folder = this.data.getFolder(folderId);
        if (!folder) return;

        const newName = prompt('Enter new folder name:', folder.name);
        if (newName && newName.trim()) {
            this.data.updateFolder(folderId, { name: newName.trim() });
            this.hideAll();
            if (this.onConversationChange) {
                this.onConversationChange();
            }
        }
    }

    async deleteFolder(folderId) {
        if (!confirm('Delete this folder? Conversations will be moved to "All Conversations".')) {
            return;
        }

        await this.data.deleteFolder(folderId);
        this.hideAll();
        if (this.onConversationChange) {
            this.onConversationChange();
        }
    }
}
