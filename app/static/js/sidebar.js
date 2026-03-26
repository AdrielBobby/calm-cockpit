document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarMenuButton = document.getElementById('sidebarMenuButton');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const navItems = document.querySelectorAll('.sidebar-item');

    // Restore desktop collapsed state
    const isCollapsed = localStorage.getItem('calm_sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth > 768) {
        document.body.classList.add('sidebar-collapsed');
    }

    // Toggle Desktop Collapse
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('calm_sidebar_collapsed', document.body.classList.contains('sidebar-collapsed'));
        });
    }

    // Toggle Mobile Drawer
    if (sidebarMenuButton) {
        sidebarMenuButton.addEventListener('click', () => {
            document.body.classList.add('sidebar-open');
        });
    }

    // Close on backdrop click (Mobile)
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            document.body.classList.remove('sidebar-open');
        }
    });

    // Handle Nav Item Clicks + Smooth Scrolling
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetEl = document.getElementById(targetId);

                // Update active class immediately
                navItems.forEach(nav => nav.classList.remove('is-active'));
                item.classList.add('is-active');

                // Close mobile sidebar if open
                if (document.body.classList.contains('sidebar-open')) {
                    document.body.classList.remove('sidebar-open');
                }

                if (targetEl) {
                    const mainContent = document.querySelector('.main-content');
                    if (mainContent) {
                        const topPos = targetEl.getBoundingClientRect().top + mainContent.scrollTop - mainContent.getBoundingClientRect().top;
                        mainContent.scrollTo({ top: topPos - 20, behavior: 'smooth' });
                    } else {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    // Optionally update history state per user request
                    history.replaceState(null, '', href);
                }
            }
        });
    });
    
    // Optional: Update active item based on scroll position using Intersection Observer
    const sections = Array.from(navItems).map(item => {
        const href = item.getAttribute('href');
        return href && href.startsWith('#') ? document.getElementById(href.substring(1)) : null;
    }).filter(Boolean);

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navItems.forEach(nav => {
                    if (nav.getAttribute('href') === `#${id}`) {
                        nav.classList.add('is-active');
                    } else {
                        nav.classList.remove('is-active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
});
