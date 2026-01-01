function pokerInputApp() {
  return {
    players: [],
    boards: [],
    nextId: 1,
    pots: [],
    boardResults: [],

    deck: [
      ...'23456789TJQKA'.split('').flatMap(
        r => ['h','d','c','s'].map(s => r + s)
      )
    ],

    ranks: '23456789TJQKA'.split(''),
    suits: ['h','d','c','s'],

    cardPicker: {
      open: false,
      type: null,
      id: null,
      slot: null,
      index: null,
      targets: null,
      selected: [],
      max: 1
    },

    get usedCards() {
      return [
        ...this.players.flatMap(p => p.cards),
        ...this.boards.flatMap(b => [...b.flop, b.turn, b.river])
      ].filter(Boolean)
    },

    isCardDisabled(card) {
      return this.usedCards.includes(card) && !this.cardPicker.selected.includes(card)
    },

    addPlayer() {
      this.players.push({
        id: this.nextId++,
        name: '',
        cards: [null, null],
        folded: false,
        preflop: 0,
        flop: 0,
        turn: 0,
        river: 0
      })
    },

    removePlayer(idx) {
      this.players.splice(idx, 1)
    },

    addBoard() {
      this.boards.push({
        id: this.nextId++,
        flop: [null, null, null],
        turn: null,
        river: null
      })
    },

    removeBoard(idx) {
      this.boards.splice(idx, 1)
    },

    openCardPicker(type, id, slot, index = null) {
      const ctx = {
        open: true,
        type,
        id,
        slot,
        index,
        targets: null,
        selected: [],
        max: 1
      }

      if (type === 'player') {
        const p = this.players.find(p => p.id === id)
        ctx.targets = { kind: 'player', id, indices: [0, 1] }
        ctx.selected = p.cards.filter(Boolean)
        ctx.max = 2
      } else if (type === 'board') {
        const b = this.boards.find(b => b.id === id)
        if (slot === 'flop') {
          ctx.targets = { kind: 'flop', id, indices: [0, 1, 2] }
          ctx.selected = b.flop.filter(Boolean)
          ctx.max = 3
        } else if (slot === 'turn' || slot === 'river') {
          ctx.targets = { kind: slot, id }
          ctx.selected = b[slot] ? [b[slot]] : []
          ctx.max = 1
        }
      }

      this.cardPicker = ctx
    },

    closeCardPicker() {
      this.cardPicker.open = false
      this.cardPicker.type = null
      this.cardPicker.id = null
      this.cardPicker.slot = null
      this.cardPicker.index = null
      this.cardPicker.targets = null
      this.cardPicker.selected = []
      this.cardPicker.max = 1
    },

    selectCard(card) {
      const ctx = this.cardPicker
      const sel = ctx.selected || []

      if (sel.includes(card)) {
        ctx.selected = sel.filter(c => c !== card)
        return
      }

      if (sel.length >= ctx.max) return
      ctx.selected = [...sel, card]
    },

    saveSelection() {
      const ctx = this.cardPicker
      const sel = ctx.selected || []

      if (!ctx.targets) return this.closeCardPicker()

      if (ctx.targets.kind === 'player') {
        const p = this.players.find(p => p.id === ctx.targets.id)
        p.cards = [null, null]
        for (let i = 0; i < Math.min(sel.length, 2); i++) p.cards[i] = sel[i]
      } else if (ctx.targets.kind === 'flop') {
        const b = this.boards.find(b => b.id === ctx.targets.id)
        b.flop = [null, null, null]
        for (let i = 0; i < Math.min(sel.length, 3); i++) b.flop[i] = sel[i]
      } else if (ctx.targets.kind === 'turn' || ctx.targets.kind === 'river') {
        const b = this.boards.find(b => b.id === ctx.targets.id)
        b[ctx.targets.kind] = sel[0] || null
      }

      this.closeCardPicker()
    }

    ,

    buildPots() {
      const activePlayers = this.players
        .map(p => ({
          id: p.id,
          committed: (Number(p.preflop) || 0) + (Number(p.flop) || 0) + (Number(p.turn) || 0) + (Number(p.river) || 0)
        }))
        .filter(p => p.committed > 0)
        .sort((a, b) => a.committed - b.committed)

      let pots = []
      let previous = 0

      for (let i = 0; i < activePlayers.length; i++) {
        const current = activePlayers[i]
        const contribution = current.committed - previous

        if (contribution <= 0) continue

        const eligible = activePlayers
          .slice(i)
          .map(p => p.id)

        pots.push({
          amount: contribution * eligible.length,
          eligiblePlayerIds: eligible
        })

        previous = current.committed
      }

      this.pots = pots
    }
    ,

    evaluateBoards() {
      if (!window.HandEvaluator) {
        alert('HandEvaluator not available')
        return
      }

      const results = this.boards.map(board => {
        // exclude folded players from board evaluation
        const eligiblePlayers = this.players.filter(p => p.cards && p.cards[0] && p.cards[1] && !p.folded)

        if (!eligiblePlayers.length) return { tiers: [] }

        try {
          // get evaluated hands (if available) to show hand names
          const evaluated = (window.HandEvaluator.evaluateHands)
            ? window.HandEvaluator.evaluateHands(eligiblePlayers, board)
            : []

          const hands = {}
          evaluated.forEach(e => {
            const h = e.hand
            const display = (h && (h.name || h.descr)) || (h && h.toString && h.toString()) || null
            hands[e.playerId] = display
          })

          // determineRankings returns ordered tiers: [[topWinners], [runnersUp], ...]
          const tiers = (window.HandEvaluator.determineRankings || window.HandEvaluator.determineWinners && (() => { return [window.HandEvaluator.determineWinners(eligiblePlayers, board)] }))
            ? window.HandEvaluator.determineRankings(eligiblePlayers, board)
            : [window.HandEvaluator.determineWinners(eligiblePlayers, board)]

          return { tiers, hands }
        } catch (e) {
          console.error('Evaluation error', e)
          return { tiers: [] }
        }
      })

      this.boardResults = results
    }

    ,

    isBoardComplete(board) {
      if (!board) return false
      const flopCount = Array.isArray(board.flop) ? board.flop.filter(Boolean).length : 0
      return flopCount === 3 && !!board.turn && !!board.river
    }

    ,

    get allBoardsComplete() {
      return this.boards && this.boards.length > 0 && this.boards.every(b => this.isBoardComplete(b))
    }

    ,

    isPlayerComplete(player) {
      if (!player) return false
      return Array.isArray(player.cards) && Boolean(player.cards[0]) && Boolean(player.cards[1])
    }

    ,

    get canEvaluate() {
      const enoughPlayers = this.players && this.players.length > 1
      const playersComplete = enoughPlayers && this.players.every(p => this.isPlayerComplete(p))
      return !!(this.allBoardsComplete && playersComplete)
    }

    ,

    computePayouts({ pots = null, boardResults = null, boardsCount = null } = {}) {
      // Ensure pots exist
      if (!pots || !pots.length) {
        this.buildPots()
        pots = this.pots
      }

      // Ensure boardResults exist
      if (!boardResults || !boardResults.length) {
        this.evaluateBoards()
        boardResults = this.boardResults
      }

      boardsCount = boardsCount || this.boards.length || (boardResults && boardResults.length) || 1

      const totals = {}
      this.players.forEach(p => { totals[p.id] = 0 })

      const perPot = (pots || []).map(pot => {
        const potAlloc = {}
        const boardShare = (pot.amount || 0) / boardsCount

        for (let bi = 0; bi < boardsCount; bi++) {
          const board = (boardResults && boardResults[bi]) || { tiers: [] }

          // find first tier that has eligible players
          let allocated = false
          const tiers = board.tiers || []

          // helper to check folded state by player id
          const isPlayerFolded = (pid) => {
            const p = this.players.find(x => x.id === Number(pid))
            return p ? !!p.folded : false
          }

          for (let t = 0; t < tiers.length; t++) {
            const tier = tiers[t] || []
            // only consider winners that are both in this pot and not folded
            const eligibleWinners = tier.filter(w => pot.eligiblePlayerIds.includes(Number(w)) && !isPlayerFolded(w))
            if (eligibleWinners.length) {
              const sharePerWinner = boardShare / eligibleWinners.length
              eligibleWinners.forEach(w => {
                totals[w] = (totals[w] || 0) + sharePerWinner
                potAlloc[w] = (potAlloc[w] || 0) + sharePerWinner
              })
              allocated = true
              break
            }
          }

          // fallback: no tier had eligible players -> split among eligible players
          if (!allocated) {
            // split among eligible (non-folded) players for this pot
            const fallback = (pot.eligiblePlayerIds || []).filter(id => {
              const p = this.players.find(x => x.id === Number(id))
              return p && !p.folded
            })
            const sharePerWinner = boardShare / Math.max(1, fallback.length)
            fallback.forEach(w => {
              totals[w] = (totals[w] || 0) + sharePerWinner
              potAlloc[w] = (potAlloc[w] || 0) + sharePerWinner
            })
          }
        }

        const allocations = Object.keys(potAlloc).map(id => {
          const amt = Math.round(potAlloc[id] * 100) / 100
          const percent = pot.amount ? +(amt / pot.amount * 100).toFixed(2) : 0
          return { playerId: Number(id), amount: amt, percent }
        })

        return { amount: pot.amount, allocations }
      })

      Object.keys(totals).forEach(id => { totals[id] = Math.round(totals[id] * 100) / 100 })

      const result = { totals, perPot }
      this.payouts = result
      return result
    }
    ,

    formatAmount(v) {
      if (v == null || isNaN(v)) return '0.00'
      return (Math.round(Number(v) * 100) / 100).toFixed(2)
    },

    getCardRank(card) {
      if (!card) return ''
      return card.slice(0, card.length - 1)
    },

    getSuitSymbol(card) {
      if (!card) return ''
      const s = card.slice(-1)
      if (s === 'h') return '&#9829;'
      if (s === 'd') return '&#9830;'
      if (s === 'c') return '&#9827;'
      return '&#9824;'
    },

    getSuitColorClass(card) {
      if (!card) return ''
      const s = card.slice(-1)
      return (s === 'h' || s === 'd') ? 'red-suit' : 'black-suit'
    },

    getPlayerCardsDisplay(id) {
      const pid = Number(id)
      const p = this.players.find(x => x.id === pid)
      if (!p) return ''
      const c = Array.isArray(p.cards) ? p.cards.filter(Boolean) : []
      return c.length ? c.join(' ') : ''
    },

    getPlayerLabel(id) {
      const pid = Number(id)
      const p = this.players.find(x => x.id === pid)
      if (p && p.name && String(p.name).trim()) return p.name
      return 'Player ' + pid
    }

    ,

    isPlayerFolded(id) {
      const pid = Number(id)
      const p = this.players.find(x => x.id === pid)
      return p ? !!p.folded : false
    }
  }
}

// const players = [
//   { id: 1, cards: ['Ah', 'Ad'] },
//   { id: 2, cards: ['Kh', 'Kd'] }
// ]

// const board = {
//   flop: ['2c', '7d', 'Ts'],
//   turn: '9h',
//   river: 'As'
// }

// const winners = window.HandEvaluator.determineWinners(players, board)
// console.log(winners) // [1]