// interactive-fiction-engine.js - Engine per Interactive Fiction professionale

class InteractiveFictionEngine {
    constructor() {
        this.currentScene = 'intro';
        this.gameState = {
            inventory: [],
            stats: {
                health: 100,
                mana: 50,
                experience: 0
            },
            flags: new Set(),
            visitedScenes: new Set()
        };
        this.scenes = {};
        this.saveSlots = 3;
        this.init();
    }

    init() {
        this.loadScenes();
        this.setupEventListeners();
        this.loadGameState();
        this.renderCurrentScene();
    }

    // Sistema di Scene
    addScene(id, sceneData) {
        this.scenes[id] = {
            title: sceneData.title,
            description: sceneData.description,
            image: sceneData.image || null,
            choices: sceneData.choices || [],
            actions: sceneData.actions || [],
            conditions: sceneData.conditions || null,
            ...sceneData
        };
    }

    loadScenes() {
        // Scene di esempio - espandibile
        this.addScene('intro', {
            title: 'Il Risveglio',
            description: `
                Ti risvegli in un antico santuario, circondato da rune luminescenti. 
                L'aria è densa di magia e un brivido percorre la tua spina dorsale. 
                Davanti a te si aprono tre corridoi, ognuno emanando un'aura diversa.
            `,
            image: 'example-panorama.jpg',
            choices: [
                {
                    text: 'Prendi il corridoio di sinistra (Aura blu)',
                    action: () => this.goToScene('left_corridor'),
                    condition: null
                },
                {
                    text: 'Prendi il corridoio centrale (Aura dorata)',
                    action: () => this.goToScene('center_corridor'),
                    condition: null
                },
                {
                    text: 'Prendi il corridoio di destra (Aura rossa)',
                    action: () => this.goToScene('right_corridor'),
                    condition: null
                },
                {
                    text: 'Esamina le rune sul pavimento',
                    action: () => this.examineRunes(),
                    condition: null
                }
            ]
        });

        this.addScene('left_corridor', {
            title: 'Il Corridoio della Saggezza',
            description: `
                Il corridoio blu ti conduce in una biblioteca antica. 
                Migliaia di tomi fluttuano nell\'aria, le pagine si voltano da sole.
                Un vecchio saggio ti osserva dall\'alto di una scala di cristallo.
            `,
            choices: [
                {
                    text: 'Parla con il saggio',
                    action: () => this.talkToSage(),
                    condition: null
                },
                {
                    text: 'Esamina un libro fluttuante',
                    action: () => this.examineBook(),
                    condition: null
                },
                {
                    text: 'Torna al santuario',
                    action: () => this.goToScene('intro'),
                    condition: null
                }
            ]
        });
    }

    // Navigazione Scene
    goToScene(sceneId) {
        if (!this.scenes[sceneId]) {
            console.error(`Scena ${sceneId} non trovata`);
            return;
        }

        this.gameState.visitedScenes.add(this.currentScene);
        this.currentScene = sceneId;
        this.renderCurrentScene();
        this.saveGameState();
    }

    renderCurrentScene() {
        const scene = this.scenes[this.currentScene];
        if (!scene) return;

        // Update title
        document.querySelector('.image-title h2').textContent = scene.title;
        
        // Update image if present
        if (scene.image) {
            const img = document.querySelector('.image-content img');
            img.src = scene.image;
            img.alt = scene.title;
        }

        // Update text content
        this.updateTextSlider(scene);

        // Update choices
        this.renderChoices(scene.choices);

        // Execute scene actions
        if (scene.actions) {
            scene.actions.forEach(action => action());
        }
    }

    updateTextSlider(scene) {
        const textSlider = document.querySelector('.text-slider');
        textSlider.innerHTML = `
            <h3>${scene.title}</h3>
            <p>${scene.description}</p>
            ${scene.image ? `
                <div class="graphic-placeholder">
                    <img src="${scene.image}" alt="${scene.title}" style="width:100%;height:auto; display: block;">
                </div>
            ` : ''}
        `;
    }

    renderChoices(choices) {
        const existingChoices = document.querySelector('.story-choices');
        if (existingChoices) {
            existingChoices.remove();
        }

        if (!choices || choices.length === 0) return;

        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'story-choices';
        
        choices.forEach((choice, index) => {
            // Check conditions
            if (choice.condition && !choice.condition(this.gameState)) {
                return;
            }

            const choiceBtn = document.createElement('button');
            choiceBtn.className = 'choice-btn';
            choiceBtn.textContent = choice.text;
            choiceBtn.addEventListener('click', () => {
                choice.action();
            });
            choicesContainer.appendChild(choiceBtn);
        });

        document.querySelector('.text-slider').appendChild(choicesContainer);
    }

    // Sistema di Salvataggio
    saveGameState(slot = 0) {
        const saveData = {
            currentScene: this.currentScene,
            gameState: {
                ...this.gameState,
                flags: Array.from(this.gameState.flags),
                visitedScenes: Array.from(this.gameState.visitedScenes)
            },
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`worldslayer_save_${slot}`, JSON.stringify(saveData));
        this.showNotification('Gioco salvato!');
    }

    loadGameState(slot = 0) {
        const saveData = localStorage.getItem(`worldslayer_save_${slot}`);
        if (!saveData) return false;

        try {
            const data = JSON.parse(saveData);
            this.currentScene = data.currentScene;
            this.gameState = {
                ...data.gameState,
                flags: new Set(data.gameState.flags),
                visitedScenes: new Set(data.gameState.visitedScenes)
            };
            return true;
        } catch (error) {
            console.error('Errore nel caricamento:', error);
            return false;
        }
    }

    // Funzioni di gioco specifiche
    examineRunes() {
        this.showNotification('Le rune brillano più intensamente quando ti avvicini...');
        this.gameState.flags.add('runes_examined');
    }

    talkToSage() {
        this.showNotification('Il saggio sussurra antiche parole di saggezza...');
        this.gameState.stats.experience += 10;
        this.updateStatsDisplay();
    }

    examineBook() {
        this.showNotification('Il libro si apre davanti a te rivelando strani simboli...');
        this.gameState.inventory.push('Ancient Knowledge');
        this.updateInventoryDisplay();
    }

    // UI Helpers
    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, duration);
    }

    updateStatsDisplay() {
        // Update stats in UI
        console.log('Stats aggiornate:', this.gameState.stats);
    }

    updateInventoryDisplay() {
        // Update inventory in UI
        console.log('Inventario:', this.gameState.inventory);
    }

    setupEventListeners() {
        // Setup keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 's':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.saveGameState();
                    }
                    break;
                case 'l':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.loadGameState();
                        this.renderCurrentScene();
                    }
                    break;
            }
        });
    }
}

// Inizializza il gioco
document.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new InteractiveFictionEngine();
});

// Utility per sviluppo
function addTestScenes() {
    const engine = window.gameEngine;
    
    engine.addScene('test_combat', {
        title: 'Incontro con il Drago',
        description: 'Un drago antico blocca il tuo cammino...',
        choices: [
            {
                text: 'Combatti',
                action: () => {
                    engine.gameState.stats.health -= 20;
                    engine.showNotification('Hai combattuto valorosamente!');
                    engine.goToScene('victory');
                }
            },
            {
                text: 'Fuggi',
                action: () => {
                    engine.showNotification('Hai scelto la saggezza...');
                    engine.goToScene('intro');
                }
            }
        ]
    });
}