const { createApp, ref, reactive, computed } = Vue;

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

        // Remove score and streak refs
        const timeLeft = ref(60);
        const timer = ref(null);

        // Add utility functions
        const formatTime = (seconds) => {
            return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        };

        const startTimer = () => {
            if (!timer.value) {
                timer.value = setInterval(() => {
                    timeLeft.value--;
                    if (timeLeft.value <= 0) {
                        clearInterval(timer.value);
                        endRound();
                    }
                }, 1000);
            }
        };

        // Add skip handler
        const handleSkip = () => {
            timeLeft.value = Math.max(0, timeLeft.value - 5); // Reduce by 5 seconds instead of 10
            loadNewWord();
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

        // Load a new word
        const loadNewWord = async () => {
            try {
                const response = await fetch('/api/words');
                const data = await response.json();
                
                message.value = '';
                currentWord.word = data.word;
                currentWord.definition = data.definition;
                revealedLetters.value = new Set();
                userInput.value = new Array(currentWord.word.length);
                showModal.value = false;
            } catch (error) {
                console.error('Error loading word:', error);
            }
        };

        // Handle virtual keyboard key press
        const handleVirtualKeyPress = (key) => {
            if (!timer.value && /^[a-z]$/.test(key)) {
                startTimer(); // Start timer on first letter
            }
            
            if (key === 'Backspace') {
                handleBackspace();
            } else if (key === 'Enter') {
                if (allFilled.value) {
                    checkWord();
                }
            } else if (/^[a-z]$/.test(key)) {
                // Get all input elements and find first empty one
                const inputs = document.querySelectorAll('.letter-input:not([disabled])');
                const emptyInput = [...inputs].find(input => !input.value);
                
                if (emptyInput) {
                    const index = parseInt(emptyInput.dataset.index);
                    emptyInput.value = key;
                    userInput.value[index] = key;
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

        // Check the guessed word
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
                // Start new timer only on correct guess
                startTimer();
                // No points or streak tracking
                
                // Celebrate animation
                const inputs = document.querySelectorAll('.letter-input');
                inputs.forEach((input, i) => {
                    setTimeout(() => {
                        input.classList.add('celebrate');
                    }, i * 100);
                });

                // Clear inputs before loading next word
                setTimeout(() => {
                    inputs.forEach(input => {
                        input.classList.remove('celebrate');
                        input.value = '';
                        input.disabled = false;
                    });
                    userInput.value = new Array(currentWord.word.length).fill(undefined);
                    revealedLetters.value = new Set();
                    
                    // Load next word after clearing
                    loadNewWord();
                }, 1500);
            } else {
                // Check each letter and mark correct ones
                [...fullGuess].forEach((letter, index) => {
                    const input = document.querySelector(`.letter-input[data-index="${index}"]`);
                    if (letter === word[index]) {
                        input.classList.add('correct-position');
                        input.disabled = true;
                        revealedLetters.value.add(index);
                    }
                });
                
                // Clear only incorrect letters
                userInput.value = userInput.value.map((val, i) => {
                    if (word[i] === val?.toLowerCase()) {
                        return val;
                    }
                    return undefined;
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
            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach(input => input.disabled = true);
            showMessage(`Round Over! The word was: ${currentWord.word}`, 'error');
            currentWord.word.split('').forEach((_, index) => revealedLetters.value.add(index));
            showResults();
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

        // Initialize the game
        loadNewWord();

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
            formatTime
        };
    }
});

app.mount('#app');
