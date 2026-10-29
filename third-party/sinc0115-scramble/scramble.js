/**
 * shuffle()
 * Shuffle the contents of an array
 *   depending the datatype of the source
 * Makes a copy. Does NOT shuffle the original.
 * Based on Steve Griffith's array shuffle prototype
 * @Parameters: Array or string
 * @Return: Scrambled Array or string, based on the provided parameter
 */
function shuffle (src) {
  const copy = [...src]

  const length = copy.length
  for (let i = 0; i < length; i++) {
    const x = copy[i]
    const y = Math.floor(Math.random() * length)
    const z = copy[y]
    copy[i] = z
    copy[y] = x
  }

  if (typeof src === 'string') {
    return copy.join('')
  }

  return copy
}


// WORDS ARRAY
 const words = ['CURIOUS', 'ELECTRICITY', 'HEADACHE', 'IMAGINATION', 'NUMERATOR', 'PENGUIN', 'SQUAWK', 'REQUIREMENT', 'SOUGHT', 'TOMATOES', 'VEGETABLE', 'PUMPKINS']
// COPIES AND SHUFFLES WORDS ARRAY
const shuffledWords = shuffle(words)


// VUE APP BEGINS
const app = new Vue({
  el: '#app',
  data: {
    gameStatus: false,
    shuffledWords: shuffledWords,
    word: '',
    shuffledWord: '',
    guess: '',
    score: 0,
    pass: 3,
    strikes: 3,
    alertResponse: '', // triggers alert box based on player input
    noMore: false, // triggered when there are no passes left
    playAgain: false // changes start modal to a play again modal
  },
  mounted: function () {

    const storedScore = localStorage.getItem('score')
    const storedStrikes = localStorage.getItem('strikes')
    const storedPass = localStorage.getItem('pass')
    var storedGameStatus = localStorage.getItem('gameStatus')
    const storedShuffledWord = localStorage.getItem('shuffledWord')
    const storedShuffledWords = localStorage.getItem('shuffledWords')
    const storedAlertResponse = localStorage.getItem('alertResponse')

    //// Checks if gameStatus is set to a string, sets the value back to a boolean
    // Made using Code Maven (src: https://code-maven.com/slides/javascript-programming/local-storage-boolean)
    if (storedGameStatus === null) {
      console.log('gameStatus was null, setting to false')
      storedGameStatus = false
    } else {
        storedGameStatus = JSON.parse(storedGameStatus)
    }
    
    if (storedScore) {
      this.score = JSON.parse(storedScore)
      this.score = this.score
    }
    if (storedStrikes) {
      this.strikes = JSON.parse(storedStrikes)
      this.strikes = this.strikes
    }
    if (storedPass) {
      this.pass = JSON.parse(storedPass)
      this.pass = this.pass
    }
    if (storedGameStatus) {
      this.gameStatus = storedGameStatus
      this.gameStatus = this.gameStatus
    }
    if (storedShuffledWord) {
      this.shuffledWord = JSON.parse(storedShuffledWord)
      this.shuffledWord = this.shuffledWord
    }
    if (storedShuffledWords) {
      this.shuffledWords = JSON.parse(storedShuffledWords)
      this.shuffledWords = this.shuffledWords
    }
    if (storedAlertResponse) {
      this.alertResponse = JSON.parse(storedAlertResponse)
      this.alertResponse = this.alertResponse
    }

    // TRIGGER START GAME MODAL 
    if (this.gameStatus == false) {
      document.addEventListener('DOMContentLoaded', function() {
        console.log('page loaded')
        $("#startModal").modal("show")
      })
    } else if (this.gameStatus) {
      console.log('Game already in session.')
    }


  },
  computed: {
    scrambleWord: function () {
      if (this.shuffledWords.length > 0) {
        if (this.strikes > 0 ) {
          console.log('Current Word: ' + this.word)
          this.shuffledWord = shuffle(this.word)
          return this.shuffledWord
        } else {
          return 'Game Over!'
        }
      } else {
        console.log('No more words!')
        this.clearInput()
        this.gameOver()
        console.log('Game Status: ' + this.gameStatus)
        return 'Game Over!'
      }
    }
  },
  methods: {
    addScore: function () {
      this.alertResponse = 'score'
      return this.score++
    },
    addStrike: function () {
      this.alertResponse = 'strike'
      return this.strikes--
    },
    passWord: function () {
      if (this.pass > 1 ) {
        this.alertResponse = 'pass'
        this.pass--
        this.word = this.shuffledWords.shift()
        this.clearInput()
        return this.scrambleWord
      } else {
        this.pass = 0
        this.alertResponse = 'noMore'
        this.noMore = true
        this.clearInput()
        console.log('No more passes!')
      }
    },
    // Made with help from StackOverflow (src: https://stackoverflow.com/questions/54196384/reset-input-on-click-vue)
    clearInput: function () {
      this.guess = ''
      event.target = ''
    },
    onLoad: function () {
      this.gameStatus = true
      inputBox.removeAttribute("disabled") // enables text input box
      console.log('Game Status: ' + this.gameStatus)
      this.word = this.shuffledWords.shift()
      this.resetValues()
      return this.scrambleWord
    },
    resetValues: function() {
      this.playAgain = true
      this.score = 0
      this.pass = 3
      this.strikes = 3
      this.alertResponse = ''
      this.noMore = false
    },
    gameOver: function () {
      inputBox.setAttribute("disabled", true) // disables text input box
      $("#startModal").modal("show")
      this.gameStatus = false
      console.log('Game Over!')
    },
    onEnter: function () {
      if (this.shuffledWords.length > 0) {
          if (this.strikes > 1 ) {
            this.guess = this.guess.toUpperCase()
            if (this.guess == this.word) {
              this.word = this.shuffledWords.shift()
              this.addScore()
              this.clearInput()
              console.log('Points: ' + this.score)
              return this.scrambleWord
            } else if (this.guess !== this.word) {
              this.addStrike()
              this.clearInput()
              console.log('Strikes: ' + this.strikes)
            } else {
              this.clearInput()
              console.log('Something is off...')
            }
          } else {
            console.log('No more strikes!')
            this.strikes = 0
            this.clearInput()
            this.gameOver()
            console.log('Game Status: ' + this.gameStatus)
            return this.scrambleWord
          }
      } else {
        return this.scrambleWord
      }
    }
  }, 
  watch: {
    score() {
      localStorage.setItem('score', JSON.stringify(this.score))
    },
    strikes() {
      localStorage.setItem('strikes', JSON.stringify(this.strikes))
    },
    pass() {
      localStorage.setItem('pass', JSON.stringify(this.pass))
    },
    // localStorage only stores strings, gameStatus will be converted back into a boolean in mounted function
    gameStatus() {
      localStorage.setItem('gameStatus', this.gameStatus)
    },
    shuffledWord() {
      localStorage.setItem('shuffledWord', JSON.stringify(this.shuffledWord))
    },
    shuffledWords() {
      localStorage.setItem('shuffledWords', JSON.stringify(this.shuffledWords))
    },
    alertResponse() {
      localStorage.setItem('alertResponse', JSON.stringify(this.alertResponse))
    }
  }
})

const inputBox = document.getElementById('guess') // grabs text input box
