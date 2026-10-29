const body = document.body;
const header = document.getElementById('header');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const themeToggle = document.getElementById('theme-toggle');
const navLinks = [...document.querySelectorAll('.nav__link')];
const sections = [...document.querySelectorAll('section[id]')];
const revealItems = [...document.querySelectorAll('.reveal')];
const filterButtons = [...document.querySelectorAll('.filter-button')];
const projectCards = [...document.querySelectorAll('.project-card')];
const counterItems = [...document.querySelectorAll('[data-count]')];
const hoverCards = [...document.querySelectorAll('.process__card, .service-card')];

const darkTheme = 'dark-theme';

const updateThemeIcon = () => {
    if (!themeToggle) {
        return;
    }

    const icon = themeToggle.querySelector('i');
    icon.className = body.classList.contains(darkTheme) ? 'uil uil-sun' : 'uil uil-moon';
};

updateThemeIcon();

const closeMenu = () => {
    navMenu?.classList.remove('is-open');
    navToggle?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
};

navToggle?.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');

    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
});

themeToggle?.addEventListener('click', () => {
    body.classList.toggle(darkTheme);
    updateThemeIcon();
});

const syncHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 20);
};

syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const revealObserver = new IntersectionObserver(
    (entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    },
    {
        threshold: 0.15,
        rootMargin: '0px 0px -80px',
    }
);

revealItems.forEach((item) => {
    const delay = item.dataset.revealDelay;

    if (delay) {
        item.style.setProperty('--reveal-delay', `${delay}ms`);
    }

    revealObserver.observe(item);
});

let countersStarted = false;

const animateCounter = (item) => {
    const target = Number(item.dataset.count);
    const duration = 1500;
    const start = performance.now();

    const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        item.textContent = Math.round(target * eased).toString();

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    };

    requestAnimationFrame(tick);
};

const counterObserver = new IntersectionObserver(
    ([entry], observer) => {
        if (!entry?.isIntersecting || countersStarted) {
            return;
        }

        countersStarted = true;
        counterItems.forEach(animateCounter);
        observer.disconnect();
    },
    { threshold: 0.4 }
);

if (counterItems.length) {
    counterObserver.observe(counterItems[0].closest('.hero__stats'));
}

const navObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            const activeLink = document.querySelector(`.nav__link[href="#${entry.target.id}"]`);

            navLinks.forEach((link) => link.classList.remove('is-active'));
            activeLink?.classList.add('is-active');
        });
    },
    {
        threshold: 0.45,
        rootMargin: '-30% 0px -45%',
    }
);

sections.forEach((section) => navObserver.observe(section));

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const filter = button.dataset.filter;

        filterButtons.forEach((item) => item.classList.remove('is-active'));
        button.classList.add('is-active');

        projectCards.forEach((card) => {
            const categories = card.dataset.category?.split(' ') ?? [];
            const isVisible = filter === 'all' || categories.includes(filter);

            card.classList.toggle('is-hidden', !isVisible);
        });
    });
});

hoverCards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        card.style.setProperty('--x', `${x}%`);
        card.style.setProperty('--y', `${y}%`);
    });
});

const parallaxCards = [...document.querySelectorAll('.parallax-card')];

window.addEventListener(
    'pointermove',
    (event) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;

        parallaxCards.forEach((card, index) => {
            const depth = (index + 1) * 7;

            card.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0) rotateX(${-y * 3}deg) rotateY(${x * 4}deg)`;
        });
    },
    { passive: true }
);
