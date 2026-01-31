/**
 * MobileUI - Handles mobile-specific UI interactions
 * - Sidebar drawer management
 * - Overlay management
 * - Mobile menu button
 * - Touch gestures
 */

export class MobileUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sidebar = null;
        this.overlay = null;
        this.mobileMenuBtn = null;
        this.isDrawerOpen = false;

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
        const searchToggle = document.getElementById('threadSearchToggle');
        const threadSearch = document.querySelector('.thread-search');

        if (!searchToggle || !threadSearch) return;

        searchToggle.addEventListener('click', () => {
            threadSearch.classList.toggle('active');
            if (threadSearch.classList.contains('active')) {
                const searchInput = document.getElementById('threadSearchInput');
                if (searchInput) searchInput.focus();
            }
        });

        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.thread-search-container')) {
                threadSearch.classList.remove('active');
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

            // Insert before the messages container ends
            chatView.appendChild(bottomNav);
        }

        // Re-bind events to the cloned navigator
        const originalSelect = document.getElementById('questionSelect');
        const clonedSelect = bottomNav.querySelector('#questionSelect');

        if (originalSelect && clonedSelect) {
            clonedSelect.id = 'questionSelectMobile';
            clonedSelect.addEventListener('change', (e) => {
                // Trigger the original select's change event
                originalSelect.value = e.target.value;
                originalSelect.dispatchEvent(new Event('change'));
            });
        }
    }
}
