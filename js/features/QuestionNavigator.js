/**
 * QuestionNavigator - Handles question navigation (first/prev/next/last, dropdown, scroll tracking)
 */

import { HtmlUtils } from '../utils/HtmlUtils.js';

export class QuestionNavigator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentPairs = [];
        this.currentQuestionIndex = -1;
        this.scrollObserver = null;
        this.messagesContainer = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('questionSelect').addEventListener('change', (e) => {
            this.jumpToQuestion(e.target.value);
        });

        document.getElementById('firstQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('first');
        });

        document.getElementById('prevQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('prev');
        });

        document.getElementById('nextQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('next');
        });

        document.getElementById('lastQuestionBtn').addEventListener('click', () => {
            this.navigateToQuestion('last');
        });
    }

    populate(pairs) {
        this.currentPairs = pairs;
        this.currentQuestionIndex = -1;

        const select = document.getElementById('questionSelect');
        select.innerHTML = '<option value="">Jump to question...</option>';

        pairs.forEach((pair) => {
            const option = document.createElement('option');
            const questionPreview = this.getQuestionPreview(pair.question.content, 60);
            option.value = pair.id;
            option.textContent = `#${pair.index} ${questionPreview}`;
            select.appendChild(option);
        });

        this.updateButtonStates();

        // Setup scroll observer after a small delay to ensure DOM is ready
        requestAnimationFrame(() => {
            this.setupScrollObserver();
        });
    }

    navigateToQuestion(direction) {
        if (this.currentPairs.length === 0) return;

        let targetIndex = 0;

        switch (direction) {
            case 'first':
                targetIndex = 0;
                break;
            case 'prev':
                if (this.currentQuestionIndex > 0) {
                    targetIndex = this.currentQuestionIndex - 1;
                } else {
                    targetIndex = 0;
                }
                break;
            case 'next':
                if (this.currentQuestionIndex < this.currentPairs.length - 1) {
                    targetIndex = this.currentQuestionIndex + 1;
                } else {
                    targetIndex = this.currentPairs.length - 1;
                }
                break;
            case 'last':
                targetIndex = this.currentPairs.length - 1;
                break;
        }

        const targetPair = this.currentPairs[targetIndex];
        if (targetPair) {
            this.jumpToQuestion(targetPair.id);
            this.currentQuestionIndex = targetIndex;
            this.updateButtonStates();

            // Update dropdown to match
            document.getElementById('questionSelect').value = targetPair.id;
        }
    }

    updateButtonStates() {
        const firstBtn = document.getElementById('firstQuestionBtn');
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const lastBtn = document.getElementById('lastQuestionBtn');

        if (this.currentPairs.length === 0) {
            firstBtn.disabled = true;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            lastBtn.disabled = true;
            return;
        }

        firstBtn.disabled = false;
        lastBtn.disabled = false;
        prevBtn.disabled = this.currentQuestionIndex <= 0;
        nextBtn.disabled = this.currentQuestionIndex >= this.currentPairs.length - 1;
    }

    getQuestionPreview(content, maxLength) {
        const text = HtmlUtils.stripHtml(content);
        return HtmlUtils.truncate(text, maxLength);
    }

    jumpToQuestion(pairId) {
        if (!pairId) return;

        const pairElement = document.querySelector(`.pair-container[data-pair-id="${pairId}"]`);
        if (pairElement) {
            pairElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Highlight the pair temporarily
            pairElement.classList.add('highlighted-starred');
            setTimeout(() => {
                pairElement.classList.remove('highlighted-starred');
            }, 2000);

            // Update current question index
            const pairIndex = this.currentPairs.findIndex(p => p.id === pairId);
            if (pairIndex !== -1) {
                this.currentQuestionIndex = pairIndex;
            }
        }
    }

    /**
     * Update current question without scrolling (for programmatic navigation)
     */
    updateCurrentQuestion(pairId) {
        const pairIndex = this.currentPairs.findIndex(p => p.id === pairId);
        if (pairIndex !== -1 && pairIndex !== this.currentQuestionIndex) {
            this.currentQuestionIndex = pairIndex;
            this.updateButtonStates();

            // Update dropdown to match
            const select = document.getElementById('questionSelect');
            if (select) {
                select.value = pairId;
            }
        }
    }

    /**
     * Find which question is currently visible based on scroll position
     */
    updateCurrentFromScroll() {
        if (!this.messagesContainer || this.currentPairs.length === 0) return;

        const containerRect = this.messagesContainer.getBoundingClientRect();
        const viewportTop = containerRect.top;
        const viewportBottom = containerRect.bottom;
        const viewportHeight = containerRect.height;

        // Target position: top 20% of the viewport
        const targetY = viewportTop + (viewportHeight * 0.2);

        let closestPair = null;
        let closestDistance = Infinity;
        let closestIndex = -1;

        // Find the pair container closest to the target position
        for (let i = 0; i < this.currentPairs.length; i++) {
            const pairElement = document.querySelector(`.pair-container[data-pair-id="${this.currentPairs[i].id}"]`);
            if (!pairElement) continue;

            const rect = pairElement.getBoundingClientRect();

            // Skip if completely outside viewport
            if (rect.bottom < viewportTop || rect.top > viewportBottom) {
                continue;
            }

            // Use the top of the element for positioning
            const distance = Math.abs(rect.top - targetY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPair = this.currentPairs[i];
                closestIndex = i;
            }
        }

        if (closestPair && closestIndex !== this.currentQuestionIndex) {
            this.currentQuestionIndex = closestIndex;
            this.updateButtonStates();

            // Update dropdown to match
            const select = document.getElementById('questionSelect');
            if (select) {
                select.value = closestPair.id;
            }
        }
    }

    setupScrollObserver() {
        // Remove existing observer/listener if any
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
            this.scrollObserver = null;
        }

        if (this.scrollHandler) {
            this.messagesContainer?.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }

        this.messagesContainer = document.getElementById('messagesContainer');
        if (!this.messagesContainer) {
            console.warn('Messages container not found for scroll observer');
            return;
        }

        // Use a scroll event listener with throttling for immediate updates
        let scrollTimeout;
        this.scrollHandler = () => {
            if (scrollTimeout) {
                cancelAnimationFrame(scrollTimeout);
            }
            scrollTimeout = requestAnimationFrame(() => {
                this.updateCurrentFromScroll();
            });
        };

        this.messagesContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

        // Initial update
        this.updateCurrentFromScroll();

        console.log(`Scroll tracking set up for ${this.currentPairs.length} pairs`);
    }
}
