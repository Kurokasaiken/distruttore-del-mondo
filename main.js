// main.js - tutto il JS dal file HTML
// Funzionalità per lo slider del testo
const textSliders = document.querySelectorAll('.text-slider');
const prevBtn = document.querySelector('.slider-btn:first-child');
const nextBtn = document.querySelector('.slider-btn:last-child');
let currentSlide = 0;

function showSlide(index) {
    textSliders.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
    });
}
showSlide(currentSlide);
prevBtn.addEventListener('click', () => {
    currentSlide = (currentSlide - 1 + textSliders.length) % textSliders.length;
    showSlide(currentSlide);
});
nextBtn.addEventListener('click', () => {
    currentSlide = (currentSlide + 1) % textSliders.length;
    showSlide(currentSlide);
});

const textContent = document.querySelector('.text-content');
const newSlides = [
    {
        title: "Il Cristallo di Luna",
        content: "Si narra che il Cristallo di Luna sia un frammento della stessa anima del mondo. Chi lo possiede può comunicare con le creature antiche e vedere attraverso il velo del tempo. Ma il suo potere attira anche le forze dell'oscurità, sempre in cerca di controllarne l'immenso potenziale."
    },
    {
        title: "I Guardiani degli Elementi",
        content: "I cinque regni sono protetti da antichi guardiani, ognuno legato a un elemento primordiale. Queste creature maestose dormono da secoli, in attesa del richiamo che le risveglierà per l'ultima battaglia. Solo i puri di cuore possono avvicinarsi senza essere consumati dalla loro potenza."
    }
];
newSlides.forEach(slide => {
    const newSlide = document.createElement('div');
    newSlide.className = 'text-slider';
    newSlide.innerHTML = `
        <h3>${slide.title}</h3>
        <p>${slide.content}</p>
        <div class="graphic-placeholder">
            [Illustrazione per: ${slide.title}]
        </div>
    `;
    textContent.insertBefore(newSlide, document.querySelector('.slider-controls'));
});
const allTextSliders = document.querySelectorAll('.text-slider');
allTextSliders.forEach((slide, i) => {
    slide.style.display = i === 0 ? 'block' : 'none';
});
prevBtn.addEventListener('click', () => {
    currentSlide = (currentSlide - 1 + allTextSliders.length) % allTextSliders.length;
    allTextSliders.forEach((slide, i) => {
        slide.style.display = i === currentSlide ? 'block' : 'none';
    });
});
nextBtn.addEventListener('click', () => {
    currentSlide = (currentSlide + 1) % allTextSliders.length;
    allTextSliders.forEach((slide, i) => {
        slide.style.display = i === currentSlide ? 'block' : 'none';
    });
});
const controlBtns = document.querySelectorAll('.control-btn');
controlBtns.forEach(btn => {
    btn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.boxShadow = '0 0 20px var(--accent-gold)';
    });
    btn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    });
});
function createStars() {
    const starrySky = document.querySelector('.starry-sky');
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.top = `${Math.random() * 100}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 3 + 1}px`;
        star.style.height = star.style.width;
        star.style.animationDuration = `${Math.random() * 5 + 3}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starrySky.appendChild(star);
    }
}
createStars();

// Regola dinamica dello spazio superiore basata sull'immagine principale
function updateTopSpaceFromImage() {
    const img = document.querySelector('.image-content img');
    if (!img) return;
    // otteniamo l'altezza visibile dell'immagine in px
    const imgRect = img.getBoundingClientRect();
    const imgHeight = imgRect.height || img.naturalHeight || 300;

    // Calcola uno spazio top proporzionale: 10% dell'altezza immagine, con min 8px e max 64px
    const computed = Math.max(8, Math.min(64, Math.round(imgHeight * 0.10)));

    // Imposta la variabile CSS in px
    document.documentElement.style.setProperty('--top-space', computed + 'px');
}

window.addEventListener('load', () => updateTopSpaceFromImage());
window.addEventListener('resize', () => updateTopSpaceFromImage());

