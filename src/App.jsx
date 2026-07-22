import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FiSun, FiMoon, FiRefreshCw, FiRotateCw, FiClock, FiUser, 
  FiLogOut, FiAward, FiX, FiCalendar, FiTarget, FiHeart, 
  FiCheckCircle, FiAlertCircle 
} from 'react-icons/fi';

import i from './assets/Gemini_Generated_Image_nl20y0nl20y0nl20.png';

// ═══════════════════════════════════════════════════════════
// ♟️ CHESS ENGINE + AI + UI
// ═══════════════════════════════════════════════════════════

const PIECE_UNICODE = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const PIECE_NAMES = {
  K: 'شاه', Q: 'وزیر', R: 'رخ', B: 'فیل', N: 'اسب', P: 'سرباز',
};

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

const PST = {
  P: [
    [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
    [-10,0,10,10,10,10,0,-10],[-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
    [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
  ],
  Q: [
    [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
    [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
    [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],
    [-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
    [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]
  ],
};

const INIT_BOARD = [
  [{t:'R',c:'b'},{t:'N',c:'b'},{t:'B',c:'b'},{t:'Q',c:'b'},{t:'K',c:'b'},{t:'B',c:'b'},{t:'N',c:'b'},{t:'R',c:'b'}],
  [{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'},{t:'P',c:'b'}],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'},{t:'P',c:'w'}],
  [{t:'R',c:'w'},{t:'N',c:'w'},{t:'B',c:'w'},{t:'Q',c:'w'},{t:'K',c:'w'},{t:'B',c:'w'},{t:'N',c:'w'},{t:'R',c:'w'}],
];

const cloneBoard = (b) => b.map(row => row.map(cell => cell ? { ...cell } : null));
const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.t === 'K' && board[r][c]?.c === color) return [r, c];
  return null;
}

function getRawMoves(board, r, c, ep, castling) {
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const { t, c: color } = piece;
  const enemy = color === 'w' ? 'b' : 'w';
  const dir = color === 'w' ? -1 : 1;

  const addIfValid = (nr, nc) => {
    if (!inBounds(nr, nc)) return false;
    if (board[nr][nc]?.c === color) return false;
    moves.push([nr, nc]);
    return !board[nr][nc];
  };

  const addSlide = (dr, dc) => {
    for (let i = 1; i < 8; i++) {
      if (!addIfValid(r + dr * i, c + dc * i)) break;
    }
  };

  switch (t) {
    case 'P': {
      const startRow = color === 'w' ? 6 : 1;
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === startRow && !board[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc)) {
          if (board[nr][nc]?.c === enemy) moves.push([nr, nc]);
          if (ep && ep[0] === nr && ep[1] === nc) moves.push([nr, nc]);
        }
      }
      break;
    }
    case 'N':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) addIfValid(r+dr, c+dc);
      break;
    case 'B': for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) addSlide(dr,dc); break;
    case 'R': for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) addSlide(dr,dc); break;
    case 'Q': for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) addSlide(dr,dc); break;
    case 'K': {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) addIfValid(r+dr,c+dc);
      if (castling) {
        const row = color === 'w' ? 7 : 0;
        if (r === row && c === 4) {
          const kSide = color === 'w' ? 'wK' : 'bK';
          const qSide = color === 'w' ? 'wQ' : 'bQ';
          if (castling[kSide] && !board[row][5] && !board[row][6] && board[row][7]?.t === 'R' && board[row][7]?.c === color) {
            if (!isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 5, enemy) && !isSquareAttacked(board, row, 6, enemy))
              moves.push([row, 6]);
          }
          if (castling[qSide] && !board[row][3] && !board[row][2] && !board[row][1] && board[row][0]?.t === 'R' && board[row][0]?.c === color) {
            if (!isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 3, enemy) && !isSquareAttacked(board, row, 2, enemy))
              moves.push([row, 2]);
          }
        }
      }
      break;
    }
  }
  return moves;
}

function isSquareAttacked(board, r, c, byColor) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = board[rr][cc];
      if (!p || p.c !== byColor) continue;
      const raw = getRawMoves(board, rr, cc, null, null);
      if (raw.some(([mr, mc]) => mr === r && mc === c)) return true;
    }
  }
  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  const enemy = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, king[0], king[1], enemy);
}

function getLegalMoves(board, r, c, ep, castling) {
  const piece = board[r][c];
  if (!piece) return [];
  const raw = getRawMoves(board, r, c, ep, castling);
  return raw.filter(([nr, nc]) => {
    const nb = cloneBoard(board);
    nb[nr][nc] = nb[r][c];
    nb[r][c] = null;
    if (piece.t === 'P' && ep && nr === ep[0] && nc === ep[1]) {
      nb[r][nc] = null;
    }
    if (piece.t === 'K' && Math.abs(nc - c) === 2) {
      const row = r;
      if (nc === 6) { nb[row][5] = nb[row][7]; nb[row][7] = null; }
      if (nc === 2) { nb[row][3] = nb[row][0]; nb[row][0] = null; }
    }
    return !isInCheck(nb, piece.c);
  });
}

function getAllLegalMoves(board, color, ep, castling) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.c === color)
        for (const [nr, nc] of getLegalMoves(board, r, c, ep, castling))
          moves.push({ from: [r, c], to: [nr, nc] });
  return moves;
}

function makeMove(board, from, to, ep) {
  const nb = cloneBoard(board);
  const piece = nb[from[0]][from[1]];
  let newEp = null;
  let captured = nb[to[0]][to[1]];

  if (piece.t === 'P' && ep && to[0] === ep[0] && to[1] === ep[1]) {
    captured = nb[from[0]][to[1]];
    nb[from[0]][to[1]] = null;
  }

  if (piece.t === 'P' && Math.abs(to[0] - from[0]) === 2) {
    newEp = [(from[0] + to[0]) / 2, from[1]];
  }

  if (piece.t === 'K' && Math.abs(to[1] - from[1]) === 2) {
    const row = from[0];
    if (to[1] === 6) { nb[row][5] = nb[row][7]; nb[row][7] = null; }
    if (to[1] === 2) { nb[row][3] = nb[row][0]; nb[row][0] = null; }
  }

  nb[to[0]][to[1]] = piece;
  nb[from[0]][from[1]] = null;

  if (piece.t === 'P' && (to[0] === 0 || to[0] === 7)) {
    nb[to[0]][to[1]] = { t: 'Q', c: piece.c };
  }

  return { board: nb, ep: newEp, captured };
}

function evaluateBoard(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.t] + (p.c === 'b' ? PST[p.t][r][c] : PST[p.t][7 - r][c]);
      score += p.c === 'b' ? val : -val;
    }
  }
  return score;
}

function minimax(board, depth, alpha, beta, isMax, ep, castling) {
  const color = isMax ? 'b' : 'w';
  const moves = getAllLegalMoves(board, color, ep, castling);

  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      return isInCheck(board, color) ? (isMax ? -99999 + (3 - depth) : 99999 - (3 - depth)) : 0;
    }
    return evaluateBoard(board);
  }

  moves.sort((a, b) => {
    const capA = board[a.to[0]][a.to[1]] ? PIECE_VALUES[board[a.to[0]][a.to[1]].t] : 0;
    const capB = board[b.to[0]][b.to[1]] ? PIECE_VALUES[board[b.to[0]][b.to[1]].t] : 0;
    return capB - capA;
  });

  if (isMax) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const { board: nb, ep: nep } = makeMove(board, move.from, move.to, ep);
      const nc = { ...castling };
      updateCastling(nc, move.from, move.to, board);
      const ev = minimax(nb, depth - 1, alpha, beta, false, nep, nc);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const { board: nb, ep: nep } = makeMove(board, move.from, move.to, ep);
      const nc = { ...castling };
      updateCastling(nc, move.from, move.to, board);
      const ev = minimax(nb, depth - 1, alpha, beta, true, nep, nc);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function updateCastling(castling, from, to, board) {
  const piece = board[from[0]][from[1]];
  if (piece.t === 'K') {
    if (piece.c === 'w') { castling.wK = false; castling.wQ = false; }
    else { castling.bK = false; castling.bQ = false; }
  }
  if (piece.t === 'R') {
    if (from[0] === 7 && from[1] === 0) castling.wQ = false;
    if (from[0] === 7 && from[1] === 7) castling.wK = false;
    if (from[0] === 0 && from[1] === 0) castling.bQ = false;
    if (from[0] === 0 && from[1] === 7) castling.bK = false;
  }
  if (to[0] === 7 && to[1] === 0) castling.wQ = false;
  if (to[0] === 7 && to[1] === 7) castling.wK = false;
  if (to[0] === 0 && to[1] === 0) castling.bQ = false;
  if (to[0] === 0 && to[1] === 7) castling.bK = false;
}

function getBestMove(board, ep, castling) {
  const moves = getAllLegalMoves(board, 'b', ep, castling);
  if (moves.length === 0) return null;
  let bestMove = moves[0];
  let bestEval = -Infinity;
  for (const move of moves) {
    const { board: nb, ep: nep } = makeMove(board, move.from, move.to, ep);
    const nc = { ...castling };
    updateCastling(nc, move.from, move.to, board);
    const ev = minimax(nb, 2, -Infinity, Infinity, false, nep, nc);
    if (ev > bestEval) { bestEval = ev; bestMove = move; }
  }
  return bestMove;
}

// ═══════════════════════════════════════════════════
// 🎨 MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function ChessGame() {
  const [board, setBoard] = useState(() => cloneBoard(INIT_BOARD));
  const [turn, setTurn] = useState('w');
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [ep, setEp] = useState(null);
  const [castling, setCastling] = useState({ wK: true, wQ: true, bK: true, bQ: true });
  const [gameStatus, setGameStatus] = useState('playing');
  const [moveHistory, setMoveHistory] = useState([]);
  const [capturedW, setCapturedW] = useState([]);
  const [capturedB, setCapturedB] = useState([]);
  const [dark, setDark] = useState(true);
  const [whiteTime, setWhiteTime] = useState(600);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [dragPiece, setDragPiece] = useState(null);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [checkSquare, setCheckSquare] = useState(null);
  
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [gameHistory, setGameHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const timerRef = useRef(null);
  const historyRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedUser = localStorage.getItem('chess_user');
      if (savedUser) {
        setUser(savedUser);
        loadGameHistory(savedUser);
        setIsLoading(false);
      } else {
        setIsLoading(false);
        setShowLogin(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const loadGameHistory = (username) => {
    const history = JSON.parse(localStorage.getItem(`chess_history_${username}`) || '[]');
    setGameHistory(history);
  };

  const saveGameResult = (result) => {
    if (!user) return;
    const newGame = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fa-IR'),
      time: new Date().toLocaleTimeString('fa-IR'),
      result,
      moves: moveHistory.length,
      duration: 600 - whiteTime,
    };
    const history = JSON.parse(localStorage.getItem(`chess_history_${user}`) || '[]');
    history.unshift(newGame);
    localStorage.setItem(`chess_history_${user}`, JSON.stringify(history));
    setGameHistory(history);
  };

  const handleLogin = () => {
    setLoginError('');
    const trimmedName = username.trim();
    
    if (!trimmedName) {
      setLoginError('لطفاً نام کاربری را وارد کنید');
      return;
    }

    let userExists = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chess_history_')) {
        const existingUser = key.replace('chess_history_', '');
        if (existingUser.toLowerCase() === trimmedName.toLowerCase()) {
          userExists = true;
          break;
        }
      }
    }

    if (userExists) {
      setLoginError('این نام کاربری قبلاً ثبت شده است. لطفاً نام دیگری انتخاب کنید.');
      return;
    }

    localStorage.setItem('chess_user', trimmedName);
    setUser(trimmedName);
    loadGameHistory(trimmedName);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('chess_user');
    setUser(null);
    setShowLogin(true);
    setUsername('');
    setGameHistory([]);
  };

  const bg = dark ? 'bg-gray-950' : 'bg-amber-50';
  const textColor = dark ? 'text-gray-100' : 'text-gray-900';
  const cardBg = dark ? 'bg-gray-900/80' : 'bg-white/80';
  const borderC = dark ? 'border-gray-700' : 'border-gray-300';

  useEffect(() => {
    if (gameStatus !== 'playing') { 
      clearInterval(timerRef.current); 
      return; 
    }
    
    if (turn === 'w') {
      timerRef.current = setInterval(() => {
        setWhiteTime(p => { 
          if (p <= 1) { 
            setGameStatus('black_wins_time'); 
            return 0; 
          } 
          return p - 1; 
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    
    return () => clearInterval(timerRef.current);
  }, [turn, gameStatus]);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [moveHistory]);

  useEffect(() => {
    if (gameStatus !== 'playing' && gameStatus !== 'draw') {
      let result = '';
      if (gameStatus === 'white_wins') result = 'برد شما';
      else if (gameStatus === 'black_wins') result = 'برد کامپیوتر';
      else if (gameStatus === 'white_wins_time') result = 'برد شما (وقت)';
      else if (gameStatus === 'black_wins_time') result = 'برد کامپیوتر (وقت)';
      if (result) saveGameResult(result);
    } else if (gameStatus === 'draw') {
      saveGameResult('مساوی');
    }
  }, [gameStatus]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const executeMove = useCallback((from, to) => {
    const piece = board[from[0]][from[1]];
    if (!piece || piece.c !== turn) return;

    const currentLegal = getLegalMoves(board, from[0], from[1], ep, castling);
    if (!currentLegal.some(([r, c]) => r === to[0] && c === to[1])) return;

    const { board: nb, ep: nep, captured } = makeMove(board, from, to, ep);
    const nc = { ...castling };
    updateCastling(nc, from, to, board);

    if (captured) {
      if (captured.c === 'w') setCapturedW(p => [...p, captured]);
      else setCapturedB(p => [...p, captured]);
    }

    const cols = 'abcdefgh';
    const moveStr = `${PIECE_NAMES[piece.t]} ${cols[from[1]]}${8 - from[0]} → ${cols[to[1]]}${8 - to[0]}${captured ? ' ✕' : ''}`;
    setMoveHistory(p => [...p, { move: moveStr, color: turn }]);

    setBoard(nb);
    setEp(nep);
    setCastling(nc);
    setSelected(null);
    setLegalMoves([]);
    setLastMove({ from, to });

    const enemy = turn === 'w' ? 'b' : 'w';
    const king = findKing(nb, enemy);
    if (king && isInCheck(nb, enemy)) setCheckSquare(king);
    else setCheckSquare(null);

    const enemyMoves = getAllLegalMoves(nb, enemy, nep, nc);
    if (enemyMoves.length === 0) {
      if (isInCheck(nb, enemy)) setGameStatus(turn === 'w' ? 'white_wins' : 'black_wins');
      else setGameStatus('draw');
    }
    setTurn(enemy);
  }, [board, turn, ep, castling]);

  useEffect(() => {
    if (turn === 'b' && gameStatus === 'playing') {
      setThinking(true);
      const timeout = setTimeout(() => {
        const best = getBestMove(board, ep, castling);
        if (best) executeMove(best.from, best.to);
        setThinking(false);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [turn, gameStatus]);

  const handleSquareClick = (r, c) => {
    if (gameStatus !== 'playing' || turn !== 'w' || thinking) return;
    const piece = board[r][c];

    if (selected) {
      if (legalMoves.some(([mr, mc]) => mr === r && mc === c)) {
        executeMove(selected, [r, c]);
        return;
      }
      if (piece?.c === 'w') {
        setSelected([r, c]);
        setLegalMoves(getLegalMoves(board, r, c, ep, castling));
        return;
      }
      setSelected(null);
      setLegalMoves([]);
    } else if (piece?.c === 'w') {
      setSelected([r, c]);
      setLegalMoves(getLegalMoves(board, r, c, ep, castling));
    }
  };

  const handleDragStart = (e, r, c) => {
    if (gameStatus !== 'playing' || turn !== 'w' || thinking || board[r][c]?.c !== 'w') {
      e.preventDefault(); return;
    }
    setDragPiece([r, c]);
    setSelected([r, c]);
    setLegalMoves(getLegalMoves(board, r, c, ep, castling));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${r},${c}`);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = (e, r, c) => {
    e.preventDefault();
    if (dragPiece) {
      if (legalMoves.some(([mr, mc]) => mr === r && mc === c)) {
        executeMove(dragPiece, [r, c]);
      }
      setDragPiece(null);
    }
  };

  const resetGame = () => {
    setBoard(cloneBoard(INIT_BOARD));
    setTurn('w'); setSelected(null); setLegalMoves([]); setEp(null);
    setCastling({ wK: true, wQ: true, bK: true, bQ: true });
    setGameStatus('playing'); setMoveHistory([]);
    setCapturedW([]); setCapturedB([]);
    setWhiteTime(600);
    setThinking(false); setLastMove(null); setCheckSquare(null);
  };

  const statusText = useMemo(() => {
    switch (gameStatus) {
      case 'white_wins': return 'شما برنده شدید!';
      case 'black_wins': return 'کامپیوتر برنده شد!';
      case 'white_wins_time': return 'شما برنده شدید! (اتمام وقت)';
      case 'black_wins_time': return 'کامپیوتر برنده شد! (اتمام وقت)';
      case 'draw': return 'بازی مساوی شد!';
      default: return thinking ? 'کامپیوتر در حال فکر کردن...' : turn === 'w' ? 'نوبت شما' : 'نوبت کامپیوتر';
    }
  }, [gameStatus, turn, thinking]);

  const renderPiece = (piece, r, c) => {
    if (!piece) return null;
    const key = `${piece.c}${piece.t}`;
    const isWhite = piece.c === 'w';
    
    return (
      <span
        className={`select-none cursor-grab active:cursor-grabbing transition-transform duration-150 hover:scale-110 inline-block`}
        style={{
          fontSize: 'clamp(2rem, 5vw, 3.2rem)',
          color: isWhite ? '#ffffff' : '#000000',
          WebkitTextFillColor: isWhite ? '#ffffff' : '#000000',
          WebkitTextStroke: isWhite ? '1.2px rgba(0,0,0,0.7)' : '1.2px rgba(255,255,255,0.8)',
          filter: isWhite
            ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 6px rgba(255,215,0,0.4))'
            : 'drop-shadow(0 2px 3px rgba(255,255,255,0.3)) drop-shadow(0 0 4px rgba(0,0,0,0.8))',
          textShadow: isWhite
            ? '0 0 8px rgba(255,255,255,0.5), 1px 1px 2px rgba(0,0,0,0.8)'
            : '0 0 6px rgba(255,255,255,0.4), 1px 1px 2px rgba(0,0,0,0.9)',
          lineHeight: 1,
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, r, c)}
      >
        {PIECE_UNICODE[key]}
      </span>
    );
  };

  const rows = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const colLabels = boardFlipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];

  const isGameOver = gameStatus !== 'playing';
  const userWon = gameStatus === 'white_wins' || gameStatus === 'white_wins_time';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <div className="relative w-24 h-24 mb-8">
          {/* تغییر border-blue-500 به border-gray-400 */}
          <div className="absolute inset-0 border-4 border-amber-500 rounded-lg animate-spin" style={{ animationDuration: '3s' }}></div>
          <div className="absolute inset-2 border-4 border-gray-400 rounded-lg animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl animate-pulse">♟️</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-widest animate-bounce">در حال بارگذاری شطرنج...</h2>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className={`min-h-screen ${bg} ${textColor} flex items-center justify-center p-4`}>
        <div className={`${cardBg} backdrop-blur border ${borderC} rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all hover:scale-[1.01]`}>
          <div className="text-center mb-6">
            <div className="text-6xl mb-4 animate-bounce">♟️</div>
            <h1 className="text-3xl font-black mb-2" style={{
              background: dark ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              شطرنج حرفه‌ای
            </h1>
            <p className="text-sm opacity-60">برای شروع بازی، نام کاربری جدید وارد کنید</p>
          </div>
          
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setLoginError('');
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="نام کاربری یکتا"
            className={`w-full px-4 py-3 rounded-xl border ${loginError ? 'border-red-500' : borderC} ${dark ? 'bg-gray-800' : 'bg-white'} focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2 transition-colors`}
          />
          
          {loginError && (
            <div className="mb-4 text-red-500 text-xs font-bold flex items-center gap-1">
              <FiAlertCircle /> {loginError}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <FiUser />
            ورود به بازی
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} ${textColor} transition-colors duration-500 flex flex-col items-center p-2 sm:p-4 font-sans`}>

      {/* Header */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight">
            ♟️ شطرنج حرفه‌ای
          </h1>
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg ${dark ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <FiUser className="text-sm" />
            <span className="text-xs sm:text-sm font-bold">{user}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} transition-all flex items-center gap-1`}>
            <FiCalendar className="text-sm" />
            <span className="hidden sm:inline">تاریخچه</span>
          </button>
          
          <button onClick={() => setDark(d => !d)}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${dark ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400' : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-600'} transition-all flex items-center gap-1`}>
            {dark ? <FiSun className="text-sm" /> : <FiMoon className="text-sm" />}
          </button>
          <button onClick={handleLogout}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold ${dark ? 'bg-red-900/40 hover:bg-red-800/50 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-700'} transition-all flex items-center gap-1`}>
            <FiLogOut className="text-sm" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>

      {/* Status Bar - تغییر text-blue به text-gray */}
      <div className={`w-full max-w-6xl mb-3 px-4 py-2.5 rounded-xl ${cardBg} backdrop-blur border ${borderC} text-center text-sm sm:text-base font-bold transition-all ${
        isGameOver ? 'animate-pulse' : ''
      } ${thinking ? (dark ? 'text-gray-400' : 'text-gray-600') : ''}`}>
        {statusText}
      </div>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-3 items-start">

        {/* Left Panel */}
        <div className="w-full lg:w-56 flex lg:flex-col gap-2 order-2 lg:order-1">
          
          {/* Player Timer ONLY */}
          <div className={`flex-1 rounded-xl p-3 border ${borderC} ${cardBg} backdrop-blur relative overflow-hidden`}>
             <div 
                className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-1000" 
                style={{ width: `${(whiteTime / 600) * 100}%` }}
             />
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold opacity-70 flex items-center gap-1">
                <FiUser className="text-sm" />
                {user}
              </div>
              <FiClock className="text-sm opacity-50" />
            </div>
            <div className={`text-2xl font-mono font-black text-center ${whiteTime < 60 ? 'text-red-500 animate-pulse' : ''}`}>
              {formatTime(whiteTime)}
            </div>
            <div className="text-[10px] text-center opacity-50 mt-1">زمان باقی‌مانده شما</div>
            <div className="flex flex-wrap gap-0.5 justify-center mt-2 min-h-[1.5rem]">
              {capturedB.map((p, i) => (
                <span key={i} className="text-sm" style={{ 
                  color: '#000000', 
                  WebkitTextStroke: '1px rgba(255,255,255,0.7)',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' 
                }}>
                  {PIECE_UNICODE[`${p.c}${p.t}`]}
                </span>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className={`rounded-xl p-3 border ${borderC} ${cardBg} backdrop-blur`}>
            <div className="text-xs font-bold opacity-70 mb-2 flex items-center gap-1">
              <FiAward className="text-sm" />
              آمار شما
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="opacity-60">بردها:</span>
                <span className="font-bold text-green-500">{gameHistory.filter(g => g.result.includes('برد شما')).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">باخت‌ها:</span>
                <span className="font-bold text-red-500">{gameHistory.filter(g => g.result.includes('برد کامپیوتر')).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">مساوی:</span>
                <span className="font-bold text-yellow-500">{gameHistory.filter(g => g.result === 'مساوی').length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chess Board */}
        <div className="order-1 lg:order-2 flex-1 flex justify-center">
          <div className="relative">
            <div className={`inline-block rounded-xl overflow-hidden border-2 ${dark ? 'border-amber-700/50' : 'border-amber-900/30'} shadow-2xl`}
              style={{ boxShadow: dark ? '0 0 60px rgba(251,191,36,0.1), 0 25px 50px rgba(0,0,0,0.5)' : '0 0 40px rgba(124,58,237,0.1), 0 25px 50px rgba(0,0,0,0.15)' }}>

              <div className="flex">
                <div className="w-5 sm:w-6" />
                {colLabels.map(l => (
                  <div key={l} className="text-[10px] sm:text-xs font-bold text-center opacity-50" style={{ width: 'clamp(2.5rem, 10vw, 4.5rem)' }}>{l}</div>
                ))}
                <div className="w-5 sm:w-6" />
              </div>

              {rows.map((r, ri) => (
                <div key={r} className="flex">
                  <div className="w-5 sm:w-6 flex items-center justify-center text-[10px] sm:text-xs font-bold opacity-50">{8 - r}</div>

                  {cols.map((c) => {
                    const isLight = (r + c) % 2 === 0;
                    const isSelected = selected?.[0] === r && selected?.[1] === c;
                    const isLegal = legalMoves.some(([mr, mc]) => mr === r && mc === c);
                    const isLastFrom = lastMove?.from[0] === r && lastMove?.from[1] === c;
                    const isLastTo = lastMove?.to[0] === r && lastMove?.to[1] === c;
                    const isCheck = checkSquare?.[0] === r && checkSquare?.[1] === c;
                    const hasPiece = !!board[r][c];

                    let bgClass = '';
                    if (isCheck) bgClass = dark ? 'bg-red-900/80' : 'bg-red-400/60';
                    else if (isSelected) bgClass = dark ? 'bg-amber-600/60' : 'bg-amber-400/60';
                    else if (isLastTo) bgClass = dark ? 'bg-amber-800/40' : 'bg-amber-300/50';
                    else if (isLastFrom) bgClass = dark ? 'bg-amber-900/30' : 'bg-amber-200/50';
                    else bgClass = isLight
                      ? (dark ? 'bg-amber-200/90' : 'bg-amber-100')
                      : (dark ? 'bg-amber-900/80' : 'bg-amber-700/70');

                    return (
                      <div
                        key={c}
                        className={`relative flex items-center justify-center ${bgClass} transition-colors duration-200 cursor-pointer`}
                        style={{ width: 'clamp(2.5rem, 10vw, 4.5rem)', height: 'clamp(2.5rem, 10vw, 4.5rem)' }}
                        onClick={() => handleSquareClick(r, c)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, r, c)}
                      >
                        {isLegal && !hasPiece && (
                          <div className={`absolute rounded-full ${dark ? 'bg-black/30' : 'bg-black/20'}`}
                            style={{ width: '30%', height: '30%' }} />
                        )}
                        {/* تغییر border-blue به border-gray */}
                        {isLegal && hasPiece && (
                          <div className={`absolute inset-0.5 rounded-full border-4 ${dark ? 'border-gray-500/50' : 'border-gray-600/50'}`} />
                        )}

                        {renderPiece(board[r][c], r, c)}
                      </div>
                    );
                  })}

                  <div className="w-5 sm:w-6 flex items-center justify-center text-[10px] sm:text-xs font-bold opacity-50">{8 - r}</div>
                </div>
              ))}

              <div className="flex">
                <div className="w-5 sm:w-6" />
                {colLabels.map(l => (
                  <div key={l} className="text-[10px] sm:text-xs font-bold text-center opacity-50" style={{ width: 'clamp(2.5rem, 10vw, 4.5rem)' }}>{l}</div>
                ))}
                <div className="w-5 sm:w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Move History - تغییر text-blue به text-gray */}
        <div className={`w-full lg:w-56 order-3 rounded-xl border ${borderC} ${cardBg} backdrop-blur overflow-hidden`}>
          <div className={`px-3 py-2 text-xs font-bold border-b ${borderC} flex justify-between items-center`}>
            <span className="flex items-center gap-1">
              <FiTarget className="text-sm" />
              تاریخچه حرکات
            </span>
            <button onClick={resetGame}
              className={`px-2 py-1 rounded text-[10px] font-bold ${dark ? 'bg-red-900/40 hover:bg-red-800/50 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-700'} transition-all flex items-center gap-1`}>
              <FiRefreshCw className="text-xs" />
              جدید
            </button>
          </div>
          <div ref={historyRef} className="max-h-48 lg:max-h-96 overflow-y-auto p-2 space-y-1 scrollbar-thin" dir="rtl">
            {moveHistory.length === 0 && (
              <div className="text-center text-xs opacity-40 py-4">بازی را شروع کنید...</div>
            )}
            {moveHistory.map((m, i) => (
              <div key={i} className={`text-xs px-2 py-1 rounded ${dark ? 'bg-gray-800/50' : 'bg-gray-100'} flex justify-between`}>
                <span className="opacity-50">{i + 1}.</span>
                <span className={m.color === 'w' ? (dark ? 'text-amber-300' : 'text-amber-700') : (dark ? 'text-gray-300' : 'text-gray-700')}>
                  {m.move}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowHistory(false)}>
          <div className={`${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black flex items-center gap-2">
                <FiCalendar />
                تاریخچه بازی‌ها
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 rounded-lg hover:bg-gray-800/50 transition-all">
                <FiX />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {gameHistory.length === 0 ? (
                <div className="text-center py-8 opacity-50">
                  <FiAward className="text-4xl mx-auto mb-2" />
                  <p>هنوز بازی‌ای انجام نداده‌اید</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gameHistory.map((game) => (
                    <div key={game.id} className={`p-3 rounded-lg border ${borderC} ${dark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {game.result.includes('برد شما') ? (
                            <FiCheckCircle className="text-green-500" />
                          ) : game.result === 'مساوی' ? (
                            <FiAlertCircle className="text-yellow-500" />
                          ) : (
                            <FiX className="text-red-500" />
                          )}
                          <span className="font-bold text-sm">{game.result}</span>
                        </div>
                        <span className="text-xs opacity-50">{game.date}</span>
                      </div>
                      <div className="flex justify-between text-xs opacity-60">
                        <span>{game.time}</span>
                        <span>{game.moves} حرکت</span>
                        <span>{formatTime(game.duration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={resetGame}>
          <div className={`${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl p-8 text-center max-w-md w-full shadow-2xl`}
            onClick={e => e.stopPropagation()}>
            <div className="text-7xl mb-4 animate-bounce">
              {userWon ? '🏆' : gameStatus === 'draw' ? '🤝' : '💀'}
            </div>
            <h2 className="text-3xl font-black mb-3">
              {userWon ? 'تبریک!' : gameStatus === 'draw' ? 'مساوی!' : 'متأسفانه باختید!'}
            </h2>
            <p className="text-lg mb-6 opacity-80">
              {userWon ? 'شما برنده شدید! آفرین!' : gameStatus === 'draw' ? 'بازی با تساوی به پایان رسید' : 'کامپیوتر برنده شد. دوباره تلاش کنید!'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={resetGame}
                className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2">
                <FiRefreshCw />
                بازی جدید
              </button>
              <button onClick={() => setShowHistory(true)}
                className={`px-6 py-3 rounded-xl font-bold ${dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} transition-all flex items-center gap-2`}>
                <FiCalendar />
                تاریخچه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Creator Badge */}
      <div className="mt-8 mb-6 flex flex-col items-center justify-center gap-4">
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${borderC} ${cardBg} backdrop-blur shadow-xl transition-all hover:scale-105 cursor-default group`}>
          <div className="relative">
            <img 
              src={i} href='https://amirresume.netlify.app' target='_blank' 
              alt="Amirali Mohammadi" 
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-500 shadow-lg object-cover cursor-pointer animate-bounce"
            />
           
          </div>
          <div className="flex flex-col text-right">
            <a href='https://amirresume.netlify.app' target='_blank' rel="noreferrer" className="text-xs uppercase tracking-wider opacity-60 font-bold hover:text-amber-500 transition-colors animate-bounce">سازنده و توسعه‌دهنده</a>
            <a href='https://amirresume.netlify.app' target='_blank' rel="noreferrer" className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent hover:from-amber-300 hover:to-orange-400 transition-all  animate-bounce">
              امیرعلی محمدی
            </a>
          </div>
        </div>
        
        <div className="text-xs opacity-40 flex items-center justify-center gap-1">
          <span>ساخته شده با</span> <FiHeart className="text-red-500 animate-pulse" /> <span>| React + Tailwind CSS | شطرنج هوشمند</span>
        </div>
      </div>

    </div>
  );
}