/**
 * Documentation Renderer Module
 * Modular component for rendering in-app documentation with drawer-based navigation
 *
 * Features:
 * - Drawer-based accordion navigation
 * - Fully localized content
 * - Expandable/collapsible sections
 * - Search functionality (optional)
 * - Easy to extend with new sections
 */

import { t, getCurrentLanguage } from '../i18n/i18n.js';

export class DocumentationRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.language = getCurrentLanguage();
        this.drawers = new Map(); // Track drawer states (default all to collapsed)

        // Initialize all drawers as collapsed (false)
        this.sections().forEach(section => {
            this.drawers.set(section.id, false);
        });

        // Listen for language changes
        window.addEventListener('languageChanged', () => {
            this.language = getCurrentLanguage();
            this.render();
        });
    }

    /**
     * Main render method - renders the entire documentation
     */
    render() {
        if (!this.container) {
            console.error('[Docs] Container not found:', this.containerId);
            return;
        }

        this.container.innerHTML = '';
        const docsContainer = this.createDocsContainer();

        // Render each section
        this.sections().forEach(section => {
            const drawer = this.createDrawer(section);
            docsContainer.appendChild(drawer);
        });

        this.container.appendChild(docsContainer);
        this.attachEventListeners();
    }

    /**
     * Define documentation sections
     * Modular - add new sections here
     */
    sections() {
        return [
            {
                id: 'gettingStarted',
                icon: '',
                content: this.getGettingStartedContent()
            },
            {
                id: 'supportedPlatforms',
                icon: '',
                content: this.getSupportedPlatformsContent()
            },
            {
                id: 'organizing',
                icon: '',
                content: this.getOrganizingContent()
            },
            {
                id: 'searchFilter',
                icon: '',
                content: this.getSearchFilterContent()
            },
            {
                id: 'dataManagement',
                icon: '',
                content: this.getDataManagementContent()
            },
            {
                id: 'tipsShortcuts',
                icon: '',
                content: this.getTipsShortcutsContent()
            },
            {
                id: 'faq',
                icon: '',
                content: this.getFAQContent()
            },
            {
                id: 'github',
                icon: '⭐',
                content: this.getGitHubContent()
            }
        ];
    }

    /**
     * Create main documentation container
     */
    createDocsContainer() {
        const container = document.createElement('div');
        container.className = 'docs-container';
        return container;
    }

    /**
     * Create a drawer component
     */
    createDrawer(section) {
        const drawer = document.createElement('div');
        drawer.className = 'docs-drawer';
        drawer.dataset.sectionId = section.id;

        const isExpanded = this.drawers.get(section.id) !== false;

        const header = document.createElement('div');
        header.className = 'docs-drawer-header';
        header.innerHTML = `
            <span class="docs-drawer-icon">${section.icon}</span>
            <span class="docs-drawer-title">${this.t(section.content.titleKey)}</span>
            <svg class="docs-drawer-arrow ${isExpanded ? 'expanded' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        const content = document.createElement('div');
        content.className = `docs-drawer-content ${isExpanded ? 'expanded' : ''}`;
        content.innerHTML = this.renderDrawerContent(section.content);

        drawer.appendChild(header);
        drawer.appendChild(content);

        return drawer;
    }

    /**
     * Render drawer content based on type
     */
    renderDrawerContent(content) {
        if (content.type === 'steps') {
            return this.renderSteps(content.items);
        } else if (content.type === 'platforms') {
            return this.renderPlatforms(content.items);
        } else if (content.type === 'faq') {
            return this.renderFAQ(content.items);
        } else if (content.type === 'shortcuts') {
            return this.renderShortcuts(content.items);
        } else if (content.type === 'github') {
            return this.renderGitHubSection(content);
        } else if (content.items) {
            return this.renderList(content.items);
        }
        return '';
    }

    /**
     * Render step-by-step guide
     */
    renderSteps(steps) {
        return `
            <div class="docs-steps">
                ${steps.map((step, index) => `
                    <div class="docs-step">
                        <div class="docs-step-number">${index + 1}</div>
                        <div class="docs-step-content">
                            <h4>${this.t(step.titleKey)}</h4>
                            <p>${this.t(step.contentKey)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render platform support list
     */
    renderPlatforms(platforms) {
        return `
            <div class="docs-platforms">
                ${platforms.map(platform => `
                    <div class="docs-platform">
                        <div class="docs-platform-header">
                            <span class="docs-platform-name">${this.t(platform.nameKey)}</span>
                            <span class="docs-platform-badge">${this.t(platform.statusKey)}</span>
                        </div>
                        <p>${this.t(platform.descriptionKey)}</p>
                        ${platform.formats ? `
                            <div class="docs-platform-formats">
                                <strong>${this.t('docs.shared.formats')}:</strong>
                                ${platform.formats.map(format => `<span class="format-tag">${format}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${platform.steps ? `
                            <div class="docs-platform-steps">
                                <strong>${this.t('docs.shared.howToExport')}:</strong>
                                <ol>
                                    ${platform.steps.map(step => `<li>${this.t(step)}</li>`).join('')}
                                </ol>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render FAQ items
     */
    renderFAQ(faqs) {
        return `
            <div class="docs-faq">
                ${faqs.map(faq => `
                    <div class="docs-faq-item">
                        <h4 class="docs-faq-question">${this.t(faq.questionKey)}</h4>
                        <p class="docs-faq-answer">${this.t(faq.answerKey)}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render keyboard shortcuts
     */
    renderShortcuts(shortcuts) {
        return `
            <div class="docs-shortcuts">
                ${shortcuts.map(shortcut => `
                    <div class="docs-shortcut">
                        <span class="shortcut-action">${this.t(shortcut.actionKey)}</span>
                        <span class="shortcut-keys">${shortcut.keys.map(key => `<kbd>${key}</kbd>`).join(' + ')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render simple list
     */
    renderList(items) {
        return `
            <ul class="docs-list">
                ${items.map(item => `
                    <li>${this.t(item)}</li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Render GitHub section
     */
    renderGitHubSection(content) {
        return `
            <div class="docs-github">
                <p class="github-description">${this.t(content.descriptionKey)}</p>
                <div class="github-links">
                    <a href="${content.githubUrl}" target="_blank" rel="noopener noreferrer" class="github-link">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>${this.t(content.repositoryKey)}</span>
                    </a>
                    <a href="${content.githubUrl}" target="_blank" rel="noopener noreferrer" class="github-star-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        <span>${this.t(content.starKey)}</span>
                    </a>
                </div>
                <p class="github-encouragement">${this.t(content.encouragementKey)}</p>
            </div>
        `;
    }

    /**
     * Attach event listeners for drawer toggles
     */
    attachEventListeners() {
        const headers = this.container.querySelectorAll('.docs-drawer-header');
        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                const drawer = header.parentElement;
                const content = drawer.querySelector('.docs-drawer-content');
                const arrow = header.querySelector('.docs-drawer-arrow');
                const sectionId = drawer.dataset.sectionId;

                // Toggle expanded state
                const isExpanded = content.classList.contains('expanded');
                content.classList.toggle('expanded');
                arrow.classList.toggle('expanded');

                // Save state
                this.drawers.set(sectionId, !isExpanded);
            });
        });
    }

    /**
     * Translation helper with fallback
     */
    t(key) {
        try {
            return t(key);
        } catch (e) {
            console.warn(`[Docs] Missing translation: ${key}`);
            return key;
        }
    }

    // ==================== CONTENT DEFINITIONS ====================

    /**
     * Getting Started Section
     */
    getGettingStartedContent() {
        return {
            titleKey: 'docs.gettingStarted.title',
            type: 'steps',
            items: [
                {
                    titleKey: 'docs.gettingStarted.whatIs.title',
                    contentKey: 'docs.gettingStarted.whatIs.content'
                },
                {
                    titleKey: 'docs.gettingStarted.quickStart.title',
                    contentKey: 'docs.gettingStarted.quickStart.content'
                },
                {
                    titleKey: 'docs.gettingStarted.firstImport.title',
                    contentKey: 'docs.gettingStarted.firstImport.content'
                }
            ]
        };
    }

    /**
     * Supported Platforms Section
     */
    getSupportedPlatformsContent() {
        return {
            titleKey: 'docs.supportedPlatforms.title',
            type: 'platforms',
            items: [
                {
                    nameKey: 'docs.supportedPlatforms.chatgpt.name',
                    statusKey: 'docs.supportedPlatforms.chatgpt.status',
                    descriptionKey: 'docs.supportedPlatforms.chatgpt.description',
                    formats: ['JSON', 'HTML'],
                    steps: [
                        'docs.supportedPlatforms.chatgpt.step1',
                        'docs.supportedPlatforms.chatgpt.step2',
                        'docs.supportedPlatforms.chatgpt.step3',
                        'docs.supportedPlatforms.chatgpt.step4',
                        'docs.supportedPlatforms.chatgpt.step5'
                    ]
                },
                {
                    nameKey: 'docs.supportedPlatforms.claude.name',
                    statusKey: 'docs.supportedPlatforms.claude.status',
                    descriptionKey: 'docs.supportedPlatforms.claude.description',
                    formats: ['JSON'],
                    steps: [
                        'docs.supportedPlatforms.claude.step1',
                        'docs.supportedPlatforms.claude.step2',
                        'docs.supportedPlatforms.claude.step3',
                        'docs.supportedPlatforms.claude.step4',
                        'docs.supportedPlatforms.claude.step5'
                    ]
                },
                {
                    nameKey: 'docs.supportedPlatforms.deepseek.name',
                    statusKey: 'docs.supportedPlatforms.deepseek.status',
                    descriptionKey: 'docs.supportedPlatforms.deepseek.description',
                    formats: ['JSON'],
                    steps: [
                        'docs.supportedPlatforms.deepseek.step1',
                        'docs.supportedPlatforms.deepseek.step2',
                        'docs.supportedPlatforms.deepseek.step3',
                        'docs.supportedPlatforms.deepseek.step4'
                    ]
                },
                {
                    nameKey: 'docs.supportedPlatforms.gemini.name',
                    statusKey: 'docs.supportedPlatforms.gemini.status',
                    descriptionKey: 'docs.supportedPlatforms.gemini.description'
                }
            ]
        };
    }

    /**
     * Organizing Conversations Section
     */
    getOrganizingContent() {
        return {
            titleKey: 'docs.organizing.title',
            items: [
                'docs.organizing.folders',
                'docs.organizing.customFolders',
                'docs.organizing.moving',
                'docs.organizing.starredThreads',
                'docs.organizing.starredPairs'
            ]
        };
    }

    /**
     * Search & Filter Section
     */
    getSearchFilterContent() {
        return {
            titleKey: 'docs.searchFilter.title',
            items: [
                'docs.searchFilter.globalSearch',
                'docs.searchFilter.conversationSearch',
                'docs.searchFilter.sorting',
                'docs.searchFilter.dateFilter'
            ]
        };
    }

    /**
     * Data Management Section
     */
    getDataManagementContent() {
        return {
            titleKey: 'docs.dataManagement.title',
            items: [
                'docs.dataManagement.saving',
                'docs.dataManagement.clearing',
                'docs.dataManagement.privacy'
            ]
        };
    }

    /**
     * Tips & Shortcuts Section
     */
    getTipsShortcutsContent() {
        return {
            titleKey: 'docs.tipsShortcuts.title',
            type: 'shortcuts',
            items: [
                {
                    actionKey: 'docs.tipsShortcuts.search',
                    keys: ['Ctrl', 'F']
                },
                {
                    actionKey: 'docs.tipsShortcuts.newFolder',
                    keys: ['Ctrl', 'Shift', 'N']
                },
                {
                    actionKey: 'docs.tipsShortcuts.save',
                    keys: ['Ctrl', 'S']
                }
            ]
        };
    }

    /**
     * FAQ Section
     */
    getFAQContent() {
        return {
            titleKey: 'docs.faq.title',
            type: 'faq',
            items: [
                {
                    questionKey: 'docs.faq.offline.question',
                    answerKey: 'docs.faq.offline.answer'
                },
                {
                    questionKey: 'docs.faq.storage.question',
                    answerKey: 'docs.faq.storage.answer'
                },
                {
                    questionKey: 'docs.faq.privacy.question',
                    answerKey: 'docs.faq.privacy.answer'
                },
                {
                    questionKey: 'docs.faq.duplicates.question',
                    answerKey: 'docs.faq.duplicates.answer'
                },
                {
                    questionKey: 'docs.faq.formats.question',
                    answerKey: 'docs.faq.formats.answer'
                }
            ]
        };
    }

    /**
     * GitHub Section
     */
    getGitHubContent() {
        return {
            titleKey: 'docs.github.title',
            type: 'github',
            descriptionKey: 'docs.github.description',
            repositoryKey: 'docs.github.repository',
            starKey: 'docs.github.star',
            encouragementKey: 'docs.github.encouragement',
            // PLACEHOLDER: Replace with your actual GitHub repository URL
            githubUrl: 'https://github.com/YOUR_USERNAME/REPO_NAME'
        };
    }
}

export default DocumentationRenderer;
