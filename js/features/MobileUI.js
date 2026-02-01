/**
 * MobileUI - Handles mobile-specific UI interactions
 * - Sidebar drawer management
 * - Overlay management
 * - Mobile menu button
 * - Mobile search toggle
 * - Bottom navigation with question navigator
 * - Touch gestures
 */

export class MobileUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sidebar = null;
        this.overlay = null;
        this.mobileMenuBtn = null;
        this.isDrawerOpen = false;
        this.bottomNav = null;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
    }

    setupElements() {
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('sidebarOverlay');
        this.mobileMenuBtn = document.getElementById('mobileMenuBtn');

        if (!this.sidebar || !this.overlay || !this.mobileMenuBtn) {
            console.warn('MobileUI: Required elements not found');
            return;
        }

        this.bindEvents();
        this.handleResize();
        this.setupSearchToggle();
        this.setupMobileBottomNav();

        // Listen for window resize to setup bottom nav after resize
        window.addEventListener('resize', () => {
            this.handleResize();
            if (this.isMobile()) {
                this.setupMobileBottomNav();
            }
        });
    }

    bindEvents() {
        // Mobile menu button click
        this.mobileMenuBtn.addEventListener('click', () => {
            this.toggleDrawer();
        });

        // Overlay click - close drawer
        this.overlay.addEventListener('click', () => {
            this.closeDrawer();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle escape key to close drawer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDrawerOpen) {
                this.closeDrawer();
            }
        });

        // Handle swipe gestures for sidebar
        this.setupTouchGestures();
    }

    setupTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        const minSwipeDistance = 50;

        // Listen for touch start on sidebar
        this.sidebar.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        // Listen for touch end
        this.sidebar.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Check if horizontal swipe is greater than vertical
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
                // Swipe left - close drawer
                if (diffX < 0 && this.isDrawerOpen) {
                    this.closeDrawer();
                }
            }
        }, { passive: true });
    }

    toggleDrawer() {
        if (this.isDrawerOpen) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    openDrawer() {
        if (!this.sidebar || !this.overlay) return;

        this.sidebar.classList.add('open');
        this.overlay.classList.add('visible');
        this.isDrawerOpen = true;

        // Prevent body scroll when drawer is open
        document.body.style.overflow = 'hidden';
    }

    closeDrawer() {
        if (!this.sidebar || !this.overlay) return;

        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('visible');
        this.isDrawerOpen = false;

        // Restore body scroll
        document.body.style.overflow = '';
    }

    handleResize() {
        // Close drawer on desktop resize
        if (window.innerWidth > 768 && this.isDrawerOpen) {
            this.closeDrawer();
        }
    }

    // Check if currently in mobile view
    isMobile() {
        return window.innerWidth <= 768;
    }

    // Setup mobile search toggle functionality
    setupSearchToggle() {
        // Mobile search icon button in header
        const mobileSearchIconBtn = document.getElementById('mobileSearchIconBtn');
        const threadSearch = document.querySelector('.thread-search');
        const threadSearchInput = document.getElementById('threadSearchInput');

        if (mobileSearchIconBtn && threadSearch) {
            mobileSearchIconBtn.addEventListener('click', () => {
                const isActive = threadSearch.classList.toggle('active');
                if (isActive && threadSearchInput) {
                    // Use timeout to ensure the display is set before focusing
                    setTimeout(() => {
                        threadSearchInput.focus();
                    }, 100);
                }
            });
        }

        // Old thread search toggle button (if exists) - remove or keep for compatibility
        const searchToggle = document.getElementById('threadSearchToggle');
        if (searchToggle && threadSearch) {
            searchToggle.addEventListener('click', () => {
                threadSearch.classList.toggle('active');
                if (threadSearch.classList.contains('active') && threadSearchInput) {
                    setTimeout(() => {
                        threadSearchInput.focus();
                    }, 100);
                }
            });
        }

        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.thread-search-container') &&
                !e.target.closest('.mobile-search-icon-btn') &&
                !e.target.closest('#threadSearchToggle')) {
                if (threadSearch) threadSearch.classList.remove('active');
            }
        });
    }

    // Setup mobile bottom navigation
    setupMobileBottomNav() {
        // Only proceed if we're on mobile
        if (!this.isMobile()) return;

        const chatView = document.getElementById('chatView');
        const questionNavigator = document.querySelector('.thread-search-container .question-navigator');

        if (!chatView || !questionNavigator) return;

        // Create bottom navigation element
        let bottomNav = document.querySelector('.mobile-bottom-nav');

        if (!bottomNav) {
            bottomNav = document.createElement('div');
            bottomNav.className = 'mobile-bottom-nav';

            // Clone the question navigator
            const clonedNavigator = questionNavigator.cloneNode(true);
            bottomNav.appendChild(clonedNavigator);

            // Insert before the messages container ends (append to chatView)
            chatView.appendChild(bottomNav);

            // Re-bind events to the cloned navigator
            this.setupBottomNavEvents(bottomNav);
        }

        this.bottomNav = bottomNav;
    }

    setupBottomNavEvents(bottomNav) {
        // Get all original controls
        const originalSelect = document.getElementById('questionSelect');
        const originalButtons = {
            firstQuestionBtn: document.getElementById('firstQuestionBtn'),
            prevQuestionBtn: document.getElementById('prevQuestionBtn'),
            nextQuestionBtn: document.getElementById('nextQuestionBtn'),
            lastQuestionBtn: document.getElementById('lastQuestionBtn')
        };

        // Get all cloned controls using class selectors instead of ID
        const clonedSelect = bottomNav.querySelector('select');
        const clonedButtons = {
            firstQuestionBtn: bottomNav.querySelector('.question-nav-btn[title="First question"]'),
            prevQuestionBtn: bottomNav.querySelector('.question-nav-btn[title="Previous question"]'),
            nextQuestionBtn: bottomNav.querySelector('.question-nav-btn[title="Next question"]'),
            lastQuestionBtn: bottomNav.querySelector('.question-nav-btn[title="Last question"]')
        };

        // Sync the select dropdowns
        if (originalSelect && clonedSelect) {
            // When mobile select changes, update desktop and trigger change event
            clonedSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                originalSelect.value = value;

                // Manually trigger the change handler
                const event = new Event('change', { bubbles: true, cancelable: true });
                originalSelect.dispatchEvent(event);
            });

            // When desktop select changes, update mobile
            originalSelect.addEventListener('change', (e) => {
                clonedSelect.value = e.target.value;
            });
        }

        // Sync navigation buttons - click the original when cloned is clicked
        Object.entries(clonedButtons).forEach(([key, clonedBtn]) => {
            const originalBtn = originalButtons[key];
            if (originalBtn && clonedBtn) {
                clonedBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    originalBtn.click();
                });
            }
        });
    }
}
