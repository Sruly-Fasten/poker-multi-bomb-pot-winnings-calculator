// Requires pokersolver (https://github.com/goldfire/pokersolver)
// Include via CDN or bundler before this file. Example (pinned):
// <script src="https://cdn.jsdelivr.net/npm/pokersolver@2.1.4/dist/pokersolver.min.js"></script>

window.HandEvaluator = (() => {
  function getSolver() {
    if (window.PokerSolver) return window.PokerSolver
    if (window.pokersolver) return window.pokersolver
    if (window.pokerSolver) return window.pokerSolver
    // Some builds export classes directly (e.g. global Hand, Card). Wrap into a Solver-like shape.
    if (window.Hand && typeof window.Hand.solve === 'function') return { Hand: window.Hand }
    return null
  }

  const Solver = getSolver()
  const hasSolver = !!(Solver && Solver.Hand && typeof Solver.Hand.solve === 'function' && typeof Solver.Hand.winners === 'function')

  if (!hasSolver) {
    console.warn('pokersolver not found; HandEvaluator will return empty results.')
  }

  function buildHand(playerCards = [], board = {}) {
    const cards = []
    if (Array.isArray(playerCards)) cards.push(...playerCards.filter(Boolean))
    if (board && Array.isArray(board.flop)) cards.push(...board.flop.filter(Boolean))
    if (board && board.turn) cards.push(board.turn)
    if (board && board.river) cards.push(board.river)
    return cards
  }

  function evaluateHands(players, board) {
    if (!hasSolver) return players.map(p => ({ playerId: p.id, hand: null }))

    return players.map(player => ({
      playerId: player.id,
      hand: Solver.Hand.solve(buildHand(player.cards, board))
    }))
  }

  function determineWinners(players, board) {
    if (!hasSolver) return []

    const evaluated = evaluateHands(players, board)
    const hands = evaluated.map(h => h.hand)

    let winningHands = []
    try {
      winningHands = Solver.Hand.winners(hands)
    } catch (e) {
      console.error('pokersolver evaluation error', e)
      return []
    }

    return evaluated
      .filter(h => winningHands.includes(h.hand))
      .map(h => h.playerId)
  }

  // Returns ordered tiers of playerIds: [[topWinners], [runnersUp], ...]
  function determineRankings(players, board) {
    if (!hasSolver) return []

    const evaluated = evaluateHands(players, board)
    // clone array we'll mutate
    const remaining = evaluated.slice()
    const tiers = []

    while (remaining.length) {
      try {
        const winningHands = Solver.Hand.winners(remaining.map(r => r.hand))
        const tier = remaining.filter(r => winningHands.includes(r.hand)).map(r => r.playerId)
        tiers.push(tier)
        // remove those from remaining
        for (let pid of tier) {
          const idx = remaining.findIndex(r => r.playerId === pid)
          if (idx >= 0) remaining.splice(idx, 1)
        }
      } catch (e) {
        console.error('pokersolver ranking error', e)
        break
      }
    }

    return tiers
  }

  return {
    evaluateHands,
    determineWinners
    , determineRankings
  }
})()