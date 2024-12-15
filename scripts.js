const { createApp, ref, reactive, computed } = Vue;

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
        const partialWord = ref('');
        const resultsText = ref('');
        const showModal = ref(false);
        const showAboutModal = ref(false);

        // Computed properties
        const allFilled = computed(() => {
            return [...currentWord.word].every((_, index) => {
                return revealedLetters.value.has(index) || (userInput.value[index] !== undefined);
            });
        });

        // Load a new word
        const loadNewWord = () => {
            if (words.value.length > 0) {
                message.value = '';
                const randomWord = words.value[Math.floor(Math.random() * words.value.length)];
                currentWord.word = randomWord.word;
                currentWord.definition = randomWord.definition;
                revealedLetters.value.clear();
                userInput.value = new Array(currentWord.word.length);
                revealCount.value = 0;
                guessCount.value = 0;
                displayPartialWord();
                showModal.value = false; // Hide the modal
            } else {
                console.error('No words available');
            }
        };

        // Handle virtual keyboard key press
        const handleVirtualKeyPress = (key) => {
            if (key === 'Backspace') {
                handleBackspace();
            } else if (key === 'Enter') {
                if (allFilled.value) {
                    checkWord();
                }
            } else if (/^[a-z]$/.test(key)) {
                handleLetterInput(key);
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
            // Find first empty position in userInput array that isn't revealed
            const index = userInput.value.findIndex((val, idx) => 
                val === undefined && !revealedLetters.value.has(idx)
            );
            
            if (index !== -1) {
                userInput.value[index] = key;
                displayPartialWord(); // Refresh the display
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
                showResults();
            } else {
                shakeLetters().then(() => {
                    setTimeout(() => {
                        userInput.value = userInput.value.map((_, i) => 
                            revealedLetters.value.has(i) ? currentWord.word[i].toLowerCase() : undefined
                        );
                        displayPartialWord();
                    }, 500);
                });
            }
        };

        // Handle reveal letter button click
        const handleRevealLetter = () => {
            revealRandomLetter();
            revealCount.value++;
            displayPartialWord();
            
            const firstEmptyInput = document.querySelector('.letter-input:not([disabled])');
            if (firstEmptyInput) firstEmptyInput.focus();

            // Check if the game is over
            if (revealedLetters.value.size === currentWord.word.length) {
                endRound();
            }
        };

        // End the round
        const endRound = () => {
            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach(input => input.disabled = true);
            showMessage(`Round Over! The word was: ${currentWord.word}`, 'error');
            [...currentWord.word].forEach((_, index) => revealedLetters.value.add(index));
            displayPartialWord();
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

        // Reveal a random letter
        const revealRandomLetter = () => {
            const word = currentWord.word.toLowerCase();
            const hiddenLetters = [...word].filter((_, index) => !revealedLetters.value.has(index));
            
            if (hiddenLetters.length > 0) {
                let letterFound = false;
                while (!letterFound && revealedLetters.value.size < word.length) {
                    const randomIndex = Math.floor(Math.random() * word.length);
                    if (!revealedLetters.value.has(randomIndex)) {
                        revealedLetters.value.add(randomIndex);
                        letterFound = true;
                    }
                }
            }
        };

        // Display the partial word
        const displayPartialWord = () => {
            const wordDisplay = [...currentWord.word].map((letter, index) => {
                const value = userInput.value[index] || (revealedLetters.value.has(index) ? letter : '');
                const disabled = revealedLetters.value.has(index);
                return `<input 
                    type="text" 
                    maxlength="1" 
                    class="letter-input ${disabled ? 'revealed' : ''}" 
                    value="${value}"
                    readonly
                    inputmode="none"
                    ${disabled ? 'disabled' : ''}
                    data-index="${index}"
                >`;
            }).join('');
            
            partialWord.value = wordDisplay;

            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach(input => {
                input.addEventListener('input', handleLetterInputEvent);
                input.addEventListener('keydown', handleLetterKeydownEvent);
            });

            const firstEmptyInput = document.querySelector('input:not([disabled]):not([readonly])');
            if (firstEmptyInput) {
                setTimeout(() => firstEmptyInput.focus(), 0);
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

        // Copy results to clipboard
        const copyResults = () => {
            const textToShare = `Word Quest 🎯\n${resultsText.value}\nGuesses: ${guessCount.value}\nReveals: ${revealCount.value}\n${getEmojiResults()}`;
            
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

        // Show results in modal
        const showResults = () => {
            resultsText.value = getEmojiResults();
            showModal.value = true;
        };

        // Fetch words from JSON file
        fetch('words.json')
            .then(response => response.json())
            .then(data => {
                words.value = data.words;
                loadNewWord();
            })
            .catch(error => console.error('Error loading words:', error));

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
            loadNewWord,
            handleVirtualKeyPress,
            checkWord,
            handleRevealLetter,
            copyResults
        };
    }
});

app.mount('#app');
