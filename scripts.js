const { createApp, ref, reactive, computed, onMounted } = Vue;

const app = createApp({
    setup() {
        // Add welcome screen state
        const showWelcome = ref(true);
        const gameStarted = ref(false);

        // Reactive state variables
        const currentWord = reactive({ definition: '' });
        const userInput = ref([]);
        const revealedLetters = ref(new Set());
        const revealCount = ref(0);
        const guessCount = ref(0);
        const partialWord = computed(() => 
            createPartialWordHTML(
                currentCompound.word,
                currentCompound.prefix,
                currentCompound.suffix,
                showingPrefix.value
            )
        );
        const resultsText = ref('');
        const showModal = ref(false);
        const showAboutModal = ref(false);

        // Add streak to state variables
        const streak = ref(0);

        // Remove score and streak refs
        const timeLeft = ref(60);
        const timer = ref(null);

        // Add new game state variables
        const score = ref(0);
        const targetScore = ref(10); // Points needed to win
        const isGameWon = ref(false);

        // Simplify scoring constants
        const POINTS = {
            CORRECT: 1,     // Points for correct answer
            TARGET: 10      // Points needed to win
        };

        // Add utility functions
        const formatTime = (seconds) => {
            return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        };

        // Update startTimer to use a proper 1-second interval
        const startTimer = () => {
            if (!timer.value && gameStarted.value) {
                const startTime = Date.now();
                let elapsedSeconds = 0;

                timer.value = setInterval(() => {
                    elapsedSeconds++;
                    timeLeft.value = Math.max(0, timeLeft.value - 1);

                    if (timeLeft.value <= 0) {
                        clearInterval(timer.value);
                        timer.value = null;
                        endRound();
                    }
                }, 1000); // Update exactly every 1 second
            }
        };

        // Add startGame function
        const startGame = () => {
            showWelcome.value = false;
            gameStarted.value = true;
            currentWord.definition = currentWord.definition || ''; // Show the previously hidden definition
            startTimer();
        };

        // Remove handleHint function
        const handleHint = undefined;

        // Change allFilled from computed to ref
        const allFilled = ref(false);

        // Add loading state
        const isLoading = ref(true);

        // Add compound word state
        const showingPrefix = ref(true);
        const currentCompound = reactive({
            word: '',
            prefix: '',
            suffix: '',
            hint: '' // Use single hint property
        });

        // Add hint text state
        const hintText = ref('');

        // Remove showHint state since hints are always shown
        const showHint = undefined;

        // Simplify currentHint computed property
        const currentHint = computed(() => {
            if (!currentCompound.word) return '';
            return currentCompound.hint;
        });

        // Update loadNewWord to use single hint
        const loadNewWord = async () => {
            try {
                isLoading.value = true;
                // Pause timer
                clearInterval(timer.value);
                timer.value = null;
                
                const response = await fetch('/api/words');
                const data = await response.json();
                
                currentCompound.word = data.word.toLowerCase();
                currentCompound.prefix = data.prefix.toLowerCase();
                currentCompound.suffix = data.suffix.toLowerCase();
                currentCompound.hint = data.hint;
                
                // Update showing prefix randomly
                showingPrefix.value = Math.random() < 0.5;
                
                // Reset user input array to match hidden part length
                const hiddenLength = showingPrefix.value ? 
                    currentCompound.suffix.length : 
                    currentCompound.prefix.length;
                userInput.value = new Array(hiddenLength);
                
                revealedLetters.value = new Set();
            } catch (error) {
                console.error('Failed to fetch word:', error);
                message.value = 'Failed to load new word';
                messageType.value = 'message error visible';
            } finally {
                isLoading.value = false;
                // Resume timer if game is still active
                if (gameStarted.value) {
                    startTimer();
                }
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
                handleBackspace();
            } else if (lowercaseKey === 'enter') {
                // Check if there are any inputs and if all inputs are filled
                const inputs = document.querySelectorAll('.letter-input:not([disabled])');
                const hasInputs = inputs.length > 0;
                if (hasInputs && allFilled.value) {
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

        // Update checkWord function to fix animation timing and add time for correct answer
        const checkWord = () => {
            const userGuess = userInput.value.join('').toLowerCase();
            const correctPart = showingPrefix.value ? 
                currentCompound.suffix : 
                currentCompound.prefix;
            
            if (userGuess === correctPart) {
                // Handle correct guess
                score.value += POINTS.CORRECT;
                streak.value++;
                timeLeft.value = Math.min(60, timeLeft.value + 5); // Add 5 seconds, max 60 seconds

                if (score.value >= targetScore.value) {
                    isGameWon.value = true;
                    endRound();
                    return;
                }

                const inputs = document.querySelectorAll('.letter-input');
                let isLoadingNewWord = false;

                inputs.forEach((input, i) => {
                    setTimeout(() => {
                        input.classList.add('celebrate');
                    }, i * 100);
                });

                setTimeout(async () => {
                    if (!isLoadingNewWord) {
                        isLoadingNewWord = true;
                        await loadNewWord();
                    }
                }, 1500);
            } else {
                streak.value = 0;
                shakeLetters();
                clearInputs();
            }
        };

        // Remove handleRevealLetter since we're simplifying the game
        const handleRevealLetter = undefined;

        // Update endRound function
        const endRound = () => {
            clearInterval(timer.value);
            timer.value = null;
            
            // Get the hidden part that the user was trying to guess
            const hiddenPart = showingPrefix.value ? 
                currentCompound.suffix : 
                currentCompound.prefix;
                
            // Reveal the hidden part in the inputs
            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach((input, index) => {
                input.value = hiddenPart[index];
                input.disabled = true;
                input.classList.add('revealed');
            });

            revealedLetters.value = new Set([...Array(hiddenPart.length).keys()]);
            resultsText.value = "Game Over";
            showModal.value = true;
        };

        // Update restartGame to reset the whole game
        const restartGame = async () => {
            score.value = 0;
            isGameWon.value = false;
            streak.value = 0; // Only reset streak when starting a new game
            timeLeft.value = 60;
            guessCount.value = 0;
            revealCount.value = 0;
            showModal.value = false;
            showWelcome.value = true;
            gameStarted.value = false;
            clearInterval(timer.value);
            timer.value = null;
            await loadNewWord();
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
            const hiddenPart = showingPrefix.value ? 
                currentCompound.suffix : 
                currentCompound.prefix;
            
            allFilled.value = userInput.value.every((input, index) => 
                revealedLetters.value.has(index) || input !== undefined
            );
        };

        const clearInputs = () => {
            const inputs = document.querySelectorAll('.letter-input:not([disabled])');
            inputs.forEach(input => {
                input.value = '';
            });
            
            // Get the correct hidden part based on which part is showing
            const hiddenPart = showingPrefix.value ? 
                currentCompound.suffix : 
                currentCompound.prefix;
            
            userInput.value = userInput.value.map((_, i) => 
                revealedLetters.value.has(i) ? hiddenPart[i] : undefined
            );
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

        // Move createPartialWordHTML inside setup
        function createPartialWordHTML(fullWord, prefix, suffix, showPrefix) {
            if (!fullWord) return '';
            
            const hiddenPart = showPrefix ? suffix : prefix;
            const hiddenLength = hiddenPart.length;
            
            return Array(hiddenLength).fill('_').map((_, index) => {
                const isRevealed = revealedLetters.value?.has(index);
                return `<input type="text" 
                    class="letter-input ${isRevealed ? 'revealed' : ''}" 
                    value="${isRevealed ? hiddenPart[index] : ''}"
                    data-index="${index}"
                    maxlength="1"
                    ${isRevealed ? 'disabled' : ''}
                    inputmode="none">`;
            }).join('');
        }

        // Update handleSkip to not deduct time
        const handleSkip = async () => {
            await loadNewWord();
        };

        return {
            revealCount,
            guessCount,
            currentWord,
            partialWord,
            resultsText,
            showModal,
            showAboutModal,
            allFilled,
            loadNewWord,
            handleVirtualKeyPress,
            checkWord,
            timeLeft,
            formatTime,
            restartGame,
            showWelcome,
            startGame,
            streak,
            score,
            targetScore,
            isGameWon,
            POINTS,
            isLoading,
            currentCompound,
            showingPrefix,
            createPartialWordHTML,
            hintText,
            currentHint, // Add currentHint to returned properties
            handleSkip,
        };
    }
});

// Mount the app and store the instance
const vueApp = app.mount('#app');
