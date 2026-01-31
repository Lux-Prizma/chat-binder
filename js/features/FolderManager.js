/**
 * FolderManager - Handles folder creation and dialog
 */

import { HtmlUtils } from '../utils/HtmlUtils.js';

export class FolderManager {
    constructor(eventBus, data, onFolderChange) {
        this.eventBus = eventBus;
        this.data = data;
        this.onFolderChange = onFolderChange;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            this.showDialog();
        });

        document.getElementById('cancelNewFolder').addEventListener('click', () => {
            this.hideDialog();
        });

        document.getElementById('confirmNewFolder').addEventListener('click', () => {
            this.createFolder();
        });
    }

    showDialog() {
        const dialog = document.getElementById('newFolderDialog');
        dialog.style.display = 'flex';
        document.getElementById('newFolderName').value = '';
        document.getElementById('newFolderName').focus();

        // Reset color selection to default (purple)
        document.querySelectorAll('#presetColors .color-option').forEach(el => {
            el.classList.remove('selected');
        });
        const defaultColor = document.querySelector('#presetColors .color-option[data-color="#8b5cf6"]');
        if (defaultColor) {
            defaultColor.classList.add('selected');
        }

        // Add click handlers for color options (remove old handlers first)
        const colorOptions = document.querySelectorAll('#presetColors .color-option');
        colorOptions.forEach(option => {
            option.removeEventListener('click', this.handleColorOptionClick);
            option.addEventListener('click', this.handleColorOptionClick.bind(this));
        });
    }

    handleColorOptionClick(e) {
        e.stopPropagation();
        document.querySelectorAll('#presetColors .color-option').forEach(el => {
            el.classList.remove('selected');
        });
        e.target.classList.add('selected');
    }

    hideDialog() {
        document.getElementById('newFolderDialog').style.display = 'none';
        document.getElementById('newFolderName').value = '';
        // Reset color selection
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('.color-option[data-color="#8b5cf6"]').classList.add('selected');
    }

    async createFolder() {
        const nameInput = document.getElementById('newFolderName');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a folder name.');
            return;
        }

        const selectedColor = document.querySelector('.color-option.selected');
        const color = selectedColor ? selectedColor.dataset.color : '#8b5cf6';

        await this.data.createFolder(name, color);
        this.hideDialog();
        if (this.onFolderChange) {
            this.onFolderChange();
        }
    }
}
