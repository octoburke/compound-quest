const { createApp, ref, reactive, computed, onMounted } = Vue;

// Add the createPartialWordHTML function before creating the app
function createPartialWordHTML(word, revealedLetters) {
    const length = word?.length || 5; // Default to 5 boxes if no word
    return Array(length).fill('_').map((_, index) => {
        const isRevealed = word && revealedLetters.has(index);
        const letter = word?.[index] || '';
        return `<input type="text" 
            class="letter-input ${isRevealed ? 'revealed' : ''}" 
            value="${isRevealed ? letter : ''}" 
            data-index="${index}"
            readonly
            inputmode="none"
            ${isRevealed ? 'disabled' : ''}>`;
    }).join('');
}

const app = createApp({
    setup() {
        // Add welcome screen state
        const showWelcome = ref(true);
        const gameStarted = ref(false);

        // Reactive state variables
        const words = ref([]);
        const currentWord = reactive({ word: '', definition: '' });
        const userInput = ref([]);
        const revealedLetters = ref(new Set());
        const revealCount = ref(0);
        const guessCount = ref(0);
        const message = ref('');
        const messageType = ref('');
        const partialWord = computed(() => createPartialWordHTML(currentWord.word, revealedLetters.value));
        const resultsText = ref('');
        const showModal = ref(false);
        const showAboutModal = ref(false);

        // Add streak to state variables
        const streak = ref(0);

        // Remove score and streak refs
        const timeLeft = ref(60);
        const timer = ref(null);

        // Add utility functions
        const formatTime = (seconds) => {
            return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        };

        // Update startTimer to check if game has started
        const startTimer = () => {
            if (!timer.value && gameStarted.value) {
                timer.value = setInterval(() => {
                    timeLeft.value--;
                    if (timeLeft.value <= 0) {
                        clearInterval(timer.value);
                        endRound();
                    }
                }, 1000);
            }
        };

        // Add startGame function
        const startGame = () => {
            showWelcome.value = false;
            gameStarted.value = true;
            currentWord.definition = currentWord.definition || ''; // Show the previously hidden definition
            startTimer();
        };

        // Update the handleSkip function to not reset streak
        const handleSkip = async () => {
            timeLeft.value = Math.max(0, timeLeft.value - 5);
            await loadNewWord();  // Wait for word load to complete
        };

        // Computed properties
        const allFilled = computed(() => {
            return [...currentWord.word].every((_, index) => {
                return revealedLetters.value.has(index) || (userInput.value[index] !== undefined);
            });
        });

        const remainingLetters = computed(() => {
            return currentWord.word.length - revealedLetters.value.size;
        });

        // Update loadNewWord to always show word and definition
        const loadNewWord = async () => {
            try {
                const response = await fetch('/api/words');
                const data = await response.json();
                
                message.value = '';
                currentWord.word = data.word.toLowerCase();
                currentWord.definition = data.definition; // Always show definition
                revealedLetters.value = new Set();
                userInput.value = new Array(currentWord.word.length);
                // Remove showModal.value = false; from here
            } catch (error) {
                console.error('Failed to fetch word:', error);
                message.value = 'Failed to load new word';
                messageType.value = 'message error visible';
            }
        };

        // Fetch first word immediately and await it
        (async () => {
            await loadNewWord();
        })();

        // Update handleVirtualKeyPress to properly handle Enter case
        const handleVirtualKeyPress = (key) => {
            const lowercaseKey = key.toLowerCase();
            
            if (!timer.value && /^[a-z]$/.test(lowercaseKey)) {
                startTimer(); // Start timer on first letter
            }
            
            if (lowercaseKey === 'backspace') {
                handleBackspace();w
            } else if (lowercaseKey === 'enter') {
                // Check if there are any inputs and if all inputs are filled
                const inputs = document.querySelectorAll('.letter-input:not([disabled])');
                const hasInputs = inputs.length > 0;
                const allFilled = hasInputs && [...inputs].every(input => input.value.trim() !== '');
                
                if (allFilled) {
                    checkWord();
                }
            } else if (/^[a-z]$/.test(lowercaseKey)) {
                // Get all input elements and find first empty one
                const inputs = document.querySelectorAll('.letter-input:not([disabled])');
                const emptyInput = [...inputs].find(input => !input.value);
                
                if (emptyInput) {
                    const index = parseInt(emptyInput.dataset.index);
                    emptyInput.value = lowercaseKey;
                    userInput.value[index] = lowercaseKey;
                    updateSubmitButton();
                }
            }
        };

        // Handle backspace key press
        const handleBackspace = () => {
            const lastFilledInput = [...document.querySelectorAll('.letter-input:not([disabled])')].reverse()
                .find(input => input.value !== '');
            
            if (lastFilledInput) {
                const index = parseInt(lastFilledInput.dataset.index);
                lastFilledInput.value = '';
                userInput.value[index] = undefined;
                lastFilledInput.focus();
                updateSubmitButton();
            }
        };

        // Handle letter input
        const handleLetterInput = (key) => {
            const index = userInput.value.findIndex((val, idx) => 
                val === undefined && !revealedLetters.value.has(idx)
            );
            
            if (index !== -1) {
                userInput.value[index] = key;
                // Update the actual input element
                const input = document.querySelector(`.letter-input[data-index="${index}"]`);
                if (input) {
                    input.value = key;
                }
                updateSubmitButton();
            }
        };

        // Update checkWord function to only increment streak on correct answers
        const checkWord = () => {
            const fullGuess = [...currentWord.word].map((letter, index) => {
                if (revealedLetters.value.has(index)) {
                    return letter.toLowerCase();
                }
                return userInput.value[index]?.toLowerCase() || '';
            }).join('');
            
            const word = currentWord.word.toLowerCase();
            
            if (fullGuess.length !== word.length) {
                shakeLetters();
                const firstEmptyInput = document.querySelector('.letter-input:not([disabled])');
                if (firstEmptyInput) firstEmptyInput.focus();
                return;
            }

            guessCount.value++;

            if (fullGuess === word) {
                streak.value++;
                timeLeft.value = 60;
                clearInterval(timer.value);
                timer.value = null;
                startTimer();
                
                // Celebrate animation and load new word ONCE
                const inputs = document.querySelectorAll('.letter-input');
                let isLoadingNewWord = false;  // Flag to prevent multiple loads

                // Start celebration animation
                inputs.forEach((input, i) => {
                    setTimeout(() => {
                        input.classList.add('celebrate');
                    }, i * 100);
                });

                // Wait for celebration to finish, then load new word
                setTimeout(async () => {
                    if (!isLoadingNewWord) {
                        isLoadingNewWord = true;
                        
                        // Remove celebration classes first
                        inputs.forEach(input => {
                            input.classList.remove('celebrate');
                        });

                        // Load new word and reset inputs
                        await loadNewWord();
                        inputs.forEach(input => {
                            input.value = '';
                            input.disabled = false;
                        });
                        userInput.value = new Array(currentWord.word.length).fill(undefined);
                        revealedLetters.value = new Set();
                    }
                }, 1500);
            } else {
                // Remove streak.value = 0; from here
                
                // Clear incorrect letters but keep correct ones
                [...fullGuess].forEach((letter, index) => {
                    const input = document.querySelector(`.letter-input[data-index="${index}"]`);
                    if (letter === word[index]) {
                        input.classList.add('correct-position');
                        input.disabled = true;
                        revealedLetters.value.add(index);
                    } else {
                        input.value = '';
                        userInput.value[index] = undefined;
                    }
                });
                
                shakeLetters();
            }
        };

        // Handle reveal letter button click
        const handleRevealLetter = () => {
            if (remainingLetters.value <= 1) return;
            
            // Find the first unrevealed letter
            const firstUnrevealed = [...currentWord.word].findIndex((_, index) => 
                !revealedLetters.value.has(index)
            );
            
            if (firstUnrevealed !== -1) {
                revealedLetters.value.add(firstUnrevealed);
                revealCount.value++;
            }
        };

        // End the round
        const endRound = () => {
            clearInterval(timer.value);
            timer.value = null;
            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach(input => input.disabled = true);
            currentWord.word.split('').forEach((_, index) => revealedLetters.value.add(index));
            resultsText.value = getEmojiResults();
            showModal.value = true; // Show the game over modal
        };

        // Update restartGame to reset streak
        const restartGame = () => {
            streak.value = 0; // Only reset streak when starting a new game
            timeLeft.value = 60;
            guessCount.value = 0;
            revealCount.value = 0;
            showModal.value = false;
            showWelcome.value = true;
            gameStarted.value = false;
            timer.value = null;
            loadNewWord();
        };

        // Shake letters animation
        const shakeLetters = () => {
            return new Promise(resolve => {
                const inputs = document.querySelectorAll('.letter-input');
                inputs.forEach(input => {
                    input.classList.remove('shake');
                    void input.offsetWidth;
                    input.classList.add('shake');
                });
                setTimeout(() => {
                    inputs.forEach(input => {
                        input.classList.remove('shake');
                    });
                    resolve();
                }, 500);
            });
        };

        // Show message
        const showMessage = (text, type) => {
            message.value = text;
            messageType.value = `message ${type} visible`;
            if (!text.includes('Round Over')) {
                setTimeout(() => {
                    messageType.value = '';
                }, 3000);
            }
        };

        // Handle letter input event
        const handleLetterInputEvent = (e) => {
            const input = e.target;
            const index = parseInt(input.dataset.index);
            
            if (revealedLetters.value.has(index)) {
                e.preventDefault();
                return;
            }

            const value = input.value.toLowerCase();

            if (/^[a-z]$/.test(value)) {
                userInput.value[index] = value;
                
                let nextIndex = index + 1;
                while (nextIndex < currentWord.word.length && revealedLetters.value.has(nextIndex)) {
                    nextIndex++;
                }
                
                const nextInput = input.parentElement.querySelector(`[data-index="${nextIndex}"]`);
                if (nextInput && !nextInput.disabled) {
                    nextInput.focus();
                }
                updateSubmitButton();
            } else {
                input.value = '';
                userInput.value[index] = undefined;
                updateSubmitButton();
            }
        };

        // Handle letter keydown event
        const handleLetterKeydownEvent = (e) => {
            const input = e.target;
            const index = parseInt(input.dataset.index);

            if (revealedLetters.value.has(index)) {
                e.preventDefault();
                return;
            }

            if (e.key === 'Backspace' && !input.value) {
                const prevInput = input.parentElement.querySelector(`[data-index="${index - 1}"]`);
                if (prevInput && !prevInput.disabled) {
                    prevInput.focus();
                    prevInput.value = '';
                    userInput.value[index - 1] = undefined;
                }
                e.preventDefault();
                updateSubmitButton();
            } else if (e.key === 'Enter' && allFilled.value) {
                checkWord();
                e.preventDefault();
            }
        };

        // Update submit button state
        const updateSubmitButton = () => {
            const allFilledValue = [...currentWord.word].every((_, index) => {
                return revealedLetters.value.has(index) || (userInput.value[index] !== undefined);
            });
            allFilled.value = allFilledValue;
        };

        // Update copyResults method to only share emojis and stats
        const copyResults = () => {
            const textToShare = `Word Quest 🎯\nGuesses: ${guessCount.value}\nReveals: ${revealCount.value}\n${getEmojiResults()}`;
            
            navigator.clipboard.writeText(textToShare)
                .then(() => {
                    const btn = document.getElementById('copy-results');
                    btn.textContent = 'Copied! ✅';
                    setTimeout(() => btn.textContent = 'Copy Results 📋', 2000);
                });
        };

        // Get emoji results
        const getEmojiResults = () => {
            const emojis = [...currentWord.word].map((letter, index) => {
                if (revealedLetters.value.has(index)) {
                    return '🟨'; // Yellow square for revealed letters
                } else {
                    return '🟩'; // Green square for correctly guessed letters
                }
            });
            return emojis.join('');
        };

        const clearInputs = () => {
            const inputs = document.querySelectorAll('.letter-input:not([disabled])');
            inputs.forEach(input => {
                input.value = '';
            });
            userInput.value = userInput.value.map((_, i) => 
                revealedLetters.value.has(i) ? currentWord.word[i].toLowerCase() : undefined
            );
        };

        // Show results in modal
        const showResults = () => {
            if (timeLeft.value <= 0) {
                resultsText.value = getEmojiResults();
                showModal.value = true;
                clearInputs();
            }
        };

        // Update keyboard event listener to handle Enter key properly
        onMounted(() => {
            document.addEventListener('keydown', (event) => {
                const key = event.key;
                if (key.match(/^[a-z]$/i) || key === 'Backspace' || key === 'Enter') {
                    handleVirtualKeyPress(key);
                }
            });
        });

        return {
            revealCount,
            guessCount,
            message,
            messageType,
            currentWord,
            partialWord,
            resultsText,
            showModal,
            showAboutModal,
            allFilled,
            remainingLetters,
            loadNewWord,
            handleVirtualKeyPress,
            checkWord,
            handleRevealLetter,
            copyResults,
            handleSkip,
            timeLeft,
            formatTime,
            restartGame,
            showWelcome,
            startGame,
            streak // Add streak to returned properties
        };
    }
});

// Mount the app and store the instance
const vueApp = app.mount('#app');
