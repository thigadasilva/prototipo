import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Camera, RefreshCw, 
  ArrowLeft, Save, Plus, Home, List, User,
  Moon, Sun, ShieldCheck, CircleDot
} from 'lucide-react';
import { initDB, getInspecoes, addInspecao, syncInspecoes } from './db';

const TransparentImage = ({ src, alt, style }) => {
  const canvasRef = React.useRef(null);
  const imgRef = React.useRef(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Top-left pixel is assumed to be the background color
      const rBg = data[0], gBg = data[1], bBg = data[2];
      const threshold = 45; // Tolerance for JPEG/PNG compression artifacts

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        if (Math.abs(r - rBg) < threshold && Math.abs(g - gBg) < threshold && Math.abs(b - bBg) < threshold) {
          data[i+3] = 0; // Set alpha to 0 (transparent)
        }
      }
      ctx.putImageData(imgData, 0, 0);
      imgRef.current.src = canvas.toDataURL();
    };
  }, [src]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <img ref={imgRef} alt={alt} style={style} />
    </>
  );
};

const Logo = () => (
  <div className="logo-container" style={{ display: 'flex', alignItems: 'center' }}>
    <TransparentImage src="/logo.png" alt="Pneu Logo" style={{ width: 64, height: 64, marginRight: 2, objectFit: 'contain' }} />
    <div className="logo-text-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="logo-title" style={{ fontSize: '2rem', lineHeight: '1', fontWeight: 900 }}>
        <span className="logo-title-pneu" style={{ color: 'var(--logo-white)' }}>PNEU-</span>
        <span className="logo-title-safe" style={{ color: 'var(--logo-yellow)' }}>SAFE</span>
      </div>
      <span className="logo-subtitle" style={{ fontSize: '0.8rem', letterSpacing: '2px', color: 'var(--logo-white)', fontWeight: 600 }}>INSPEÇÃO DE PNEUS</span>
    </div>
  </div>
);

function App() {
  const [currentScreen, setCurrentScreen] = useState('login'); // 'login', 'home', 'inspection', 'feedback', 'history'
  const [inspecoes, setInspecoes] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackState, setFeedbackState] = useState({ success: true, message: '' });

  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem('pneusafe_theme') || 'light');

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [currentUser, setCurrentUser] = useState({ nome: 'Operador', turno: 'Manhã' });
  const [usersDb, setUsersDb] = useState(() => {
    const saved = localStorage.getItem('pneusafe_users');
    if (saved) return JSON.parse(saved);
    return {
      'operador': { password: '123', turno: 'Manhã', nome: 'João' },
      'operador2': { password: '123', turno: 'Tarde', nome: 'Carlos' },
      'operador3': { password: '123', turno: 'Noite', nome: 'Marcos' }
    };
  });

  // Forgot Password State
  const [resetUsername, setResetUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');

  // Inspection State
  const [pneuId, setPneuId] = useState('');
  const [isIdConfirmed, setIsIdConfirmed] = useState(false);
  const [checklist, setChecklist] = useState({
    banda_rodagem: null,
    flanco: null,
    talao: null
  });
  const [falhasDetail, setFalhasDetail] = useState({});

  useEffect(() => {
    const loadData = async () => {
      await initDB();
      refreshList();
    };
    loadData();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('pneusafe_theme', theme);
  }, [theme]);

  // Ensure inspections are refreshed when switching screens (Home or History)
  useEffect(() => {
    if (currentScreen === 'home' || currentScreen === 'history') {
      refreshList();
    }
  }, [currentScreen]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const refreshList = () => {
    setInspecoes(getInspecoes());
  };

  const inspecoesDoTurno = inspecoes.filter(insp => {
    const today = new Date().toDateString();
    return new Date(insp.timestamp).toDateString() === today;
  });

  const handleSync = async () => {
    setIsSyncing(true);
    await syncInspecoes();
    refreshList();
    setIsSyncing(false);
  };

  const startInspection = () => {
    setPneuId('');
    setIsIdConfirmed(false);
    setChecklist({ banda_rodagem: null, flanco: null, talao: null });
    setFalhasDetail({});
    setCurrentScreen('inspection');
  };

  const handleCheck = (item, isOk) => {
    setChecklist(prev => ({ ...prev, [item]: isOk }));
    if (isOk) {
      setFalhasDetail(prev => {
        const next = { ...prev };
        delete next[item];
        return next;
      });
    }
  };

  const allChecked = Object.values(checklist).every(v => v !== null);
  const isApproved = Object.values(checklist).every(v => v === true);
  
  const canSave = allChecked;

  const saveInspection = () => {
    if (!canSave) return;
    
    const status = isApproved ? 'Aprovado' : 'Reprovado';
    addInspecao(pneuId, status, isApproved ? null : falhasDetail);
    refreshList();
    
    setFeedbackState({
      success: isApproved,
      message: isApproved ? 'Pneu Aprovado!' : 'Pneu Reprovado e Salvo',
      timestamp: new Date().toLocaleString()
    });
    setCurrentScreen('feedback');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const user = usersDb[username.toLowerCase()];
    if (user && user.password === password) {
      login(user.turno, user.nome);
    } else {
      setLoginError(true);
    }
  };

  const login = (turno, nome) => {
    setCurrentUser({ nome, turno });
    setCurrentScreen('home');
    setLoginError(false);
    setUsername('');
    setPassword('');
  };

  const handlePasswordReset = (e) => {
    e.preventDefault();
    const usernameKey = resetUsername.toLowerCase();
    if (!usersDb[usernameKey]) {
      setResetError('Operador não encontrado no sistema!');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('As senhas digitadas não coincidem!');
      return;
    }
    if (newPassword.length < 3) {
      setResetError('A nova senha deve ter no mínimo 3 caracteres!');
      return;
    }
    
    const newUsersDb = {
      ...usersDb,
      [usernameKey]: {
        ...usersDb[usernameKey],
        password: newPassword
      }
    };
    setUsersDb(newUsersDb);
    localStorage.setItem('pneusafe_users', JSON.stringify(newUsersDb));
    
    alert('Senha alterada com sucesso! Você já pode fazer login.');
    setCurrentScreen('login');
    setResetUsername('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
  };

  const handleNumpad = (num) => {
    if (num === 'C') setPneuId('');
    else if (num === '<') setPneuId(pneuId.slice(0, -1));
    else setPneuId(prev => prev + num);
  };

  const renderBottomNav = () => (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '480px', backgroundColor: 'var(--card-bg)',
      borderTop: '1px solid var(--border-color)', display: 'flex',
      justifyContent: 'space-around', padding: '12px 0', zIndex: 10
    }}>
      <button onClick={() => setCurrentScreen('home')} style={{background: 'none', border: 'none', color: currentScreen === 'home' ? 'var(--primary-color)' : '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
        <Home size={28} />
        <span style={{fontSize: '0.8rem', fontWeight: currentScreen === 'home' ? 'bold' : 'normal'}}>Início</span>
      </button>
      <button onClick={() => setCurrentScreen('history')} style={{background: 'none', border: 'none', color: currentScreen === 'history' ? 'var(--primary-color)' : '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
        <List size={28} />
        <span style={{fontSize: '0.8rem', fontWeight: currentScreen === 'history' ? 'bold' : 'normal'}}>Histórico</span>
      </button>
      <button onClick={handleSync} style={{background: 'none', border: 'none', color: isSyncing ? 'var(--primary-color)' : '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
        <RefreshCw className={isSyncing ? 'spin' : ''} size={28} />
        <span style={{fontSize: '0.8rem'}}>Sincronizar</span>
      </button>
      <button onClick={() => setCurrentScreen('login')} style={{background: 'none', border: 'none', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
        <User size={28} />
        <span style={{fontSize: '0.8rem'}}>Sair</span>
      </button>
    </div>
  );

  const renderInspectionList = (list) => {
    if (list.length === 0) {
      return <p className="text-center" style={{color: '#888', marginTop: '20px'}}>Nenhuma inspeção ainda.</p>;
    }
    return list.map(insp => (
      <div key={insp.id} className="card" style={{borderLeft: `6px solid ${insp.status_final === 'Aprovado' ? 'var(--success-color)' : 'var(--danger-color)'}`}}>
        <div>
          <h3 style={{fontSize: '1.2rem'}}>Pneu: {insp.pneu_id}</h3>
          <p style={{color: '#888', fontSize: '0.9rem', marginBottom: '2px'}}>
            {new Date(insp.timestamp).toLocaleTimeString()}
          </p>
          <p style={{color: '#aaa', fontSize: '0.8rem'}}>
            {new Date(insp.timestamp).toLocaleDateString()}
          </p>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px'}}>
          <span className={`badge ${insp.status_final === 'Aprovado' ? 'badge-success' : 'badge-danger'}`}>
            {insp.status_final}
          </span>
        </div>
      </div>
    ));
  };

  if (currentScreen === 'feedback') {
    return (
      <div className="app-container" style={{backgroundColor: 'var(--bg-color)'}}>
        <div className="header" style={{justifyContent: 'center', backgroundColor: 'var(--header-bg)'}}>
          <h1 style={{color: 'white'}}>Confirmação</h1>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 20px', alignItems: 'center', justifyContent: 'center', gap: '20px', flex: 1}}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '60px', 
            backgroundColor: feedbackState.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {feedbackState.success ? <CheckCircle size={80} color="var(--success-color)" /> : <XCircle size={80} color="var(--danger-color)" />}
          </div>
          <h1 style={{fontSize: '2rem', textAlign: 'center', color: feedbackState.success ? 'var(--success-color)' : 'var(--danger-color)'}}>
            {feedbackState.message}
          </h1>
          <p style={{color: 'var(--text-color)', textAlign: 'center', marginBottom: '0'}}>Os dados foram registrados no sistema com sucesso.</p>
          <p style={{color: '#888', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold'}}>Registrado em: {feedbackState.timestamp}</p>
          
          <button className="btn-large btn-primary" onClick={() => setCurrentScreen('home')} style={{marginTop: '40px'}}>
            VOLTAR AO INÍCIO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {currentScreen === 'login' && (
        <div style={{display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--header-bg)', position: 'relative', overflow: 'hidden'}}>
          
          <button onClick={toggleTheme} style={{position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--logo-white)'}}>
            {theme === 'light' ? <Moon size={28} /> : <Sun size={28} />}
          </button>

          <div style={{flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
            
            <div style={{marginBottom: '50px'}}>
              <Logo />
            </div>
            
            <div style={{width: '100%', maxWidth: '400px', backgroundColor: 'var(--card-bg)', padding: '30px 20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'}}>
              <h2 style={{color: 'var(--text-color)', textAlign: 'center', marginBottom: '20px', fontSize: '1.5rem'}}>Login do Operador</h2>
              
              <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                <div className="input-group">
                  <span className="input-label" style={{color: 'var(--text-color)'}}>Id do Operador</span>
                  <div style={{position: 'relative'}}>
                    <User size={24} color="#888" style={{position: 'absolute', left: 16, top: 20}} />
                    <input 
                      type="text" 
                      className="input-large" 
                      style={{paddingLeft: '50px', textAlign: 'left', height: '64px'}}
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: operador"
                    />
                  </div>
                </div>
                
                <div className="input-group">
                  <span className="input-label" style={{color: 'var(--text-color)'}}>Senha</span>
                  <input 
                    type="password" 
                    className="input-large" 
                    style={{textAlign: 'left', height: '64px'}}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="***"
                  />
                </div>

                {loginError && (
                  <p className="text-center" style={{color: 'var(--danger-color)', fontWeight: 'bold'}}>Credenciais inválidas!</p>
                )}

                <button type="submit" className="btn-large btn-primary" style={{marginTop: '10px', backgroundColor: 'var(--logo-yellow)', color: '#000', fontSize: '1.4rem'}}>
                  ENTRAR
                </button>
                
                <p onClick={() => setCurrentScreen('forgot_password')} style={{textAlign: 'center', color: 'var(--primary-color)', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}>Esqueci minha senha</p>
              </form>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'forgot_password' && (
        <div style={{display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--header-bg)', position: 'relative', overflow: 'hidden'}}>
          <div style={{flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
            
            <div style={{marginBottom: '30px'}}>
              <Logo />
            </div>
            
            <div style={{width: '100%', maxWidth: '400px', backgroundColor: 'var(--card-bg)', padding: '30px 20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'}}>
              <h2 style={{color: 'var(--text-color)', textAlign: 'center', marginBottom: '20px', fontSize: '1.5rem'}}>Recuperar Senha</h2>
              
              <form onSubmit={handlePasswordReset} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                <div className="input-group">
                  <span className="input-label" style={{color: 'var(--text-color)'}}>Id do Operador</span>
                  <div style={{position: 'relative'}}>
                    <User size={24} color="#888" style={{position: 'absolute', left: 16, top: 20}} />
                    <input 
                      type="text" 
                      className="input-large" 
                      style={{paddingLeft: '50px', textAlign: 'left', height: '64px'}}
                      value={resetUsername} 
                      onChange={(e) => setResetUsername(e.target.value)}
                      placeholder="Ex: operador2"
                    />
                  </div>
                </div>
                
                <div className="input-group">
                  <span className="input-label" style={{color: 'var(--text-color)'}}>Nova Senha</span>
                  <input 
                    type="password" 
                    className="input-large" 
                    style={{textAlign: 'left', height: '64px'}}
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="***"
                  />
                </div>
                
                <div className="input-group">
                  <span className="input-label" style={{color: 'var(--text-color)'}}>Confirmar Nova Senha</span>
                  <input 
                    type="password" 
                    className="input-large" 
                    style={{textAlign: 'left', height: '64px'}}
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="***"
                  />
                </div>

                {resetError && (
                  <p className="text-center" style={{color: 'var(--danger-color)', fontWeight: 'bold'}}>{resetError}</p>
                )}

                <button type="submit" className="btn-large btn-primary" style={{marginTop: '10px', backgroundColor: 'var(--logo-yellow)', color: '#000', fontSize: '1.4rem'}}>
                  ALTERAR SENHA
                </button>
                
                <p onClick={() => {
                  setCurrentScreen('login');
                  setResetError('');
                }} style={{textAlign: 'center', color: 'var(--primary-color)', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold'}}>Voltar ao Login</p>
              </form>
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'home' && (
        <>
          <div className="header">
            <Logo />
            <button onClick={toggleTheme} style={{background: 'none', border: 'none', color: 'white'}}>
              {theme === 'light' ? <Moon size={28} /> : <Sun size={28} />}
            </button>
          </div>
          
          <div className="content" style={{paddingBottom: '80px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
              <h2 style={{fontSize: '1.4rem'}}>Olá, {currentUser.nome}</h2>
              <span className="badge" style={{backgroundColor: 'var(--primary-color)', color: 'white'}}>Turno: {currentUser.turno}</span>
            </div>

            <div style={{
              backgroundColor: 'var(--card-bg)', padding: '20px', borderRadius: '12px',
              border: '1px solid var(--border-color)', marginBottom: '10px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: theme === 'light' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
            }}>
              <div>
                <h2 style={{color: '#888', fontSize: '1rem'}}>Total Inspecionados (Turno)</h2>
                <p style={{fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-color)'}}>{inspecoesDoTurno.length}</p>
              </div>
              <CheckCircle size={48} color="var(--primary-color)" opacity={0.2} />
            </div>

            <button className="btn-large btn-primary" onClick={startInspection} style={{padding: '20px', fontSize: '1.3rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'}}>
              <Plus size={32} />
              NOVA INSPEÇÃO
            </button>
            
            <h2 style={{marginTop: '20px', fontSize: '1.2rem', color: '#888'}}>Últimas Inspeções (Turno)</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {renderInspectionList(inspecoesDoTurno.slice(0, 5))}
            </div>
          </div>
          {renderBottomNav()}
        </>
      )}

      {currentScreen === 'history' && (
        <>
          <div className="header">
            <Logo />
            <button onClick={toggleTheme} style={{background: 'none', border: 'none', color: 'white'}}>
              {theme === 'light' ? <Moon size={28} /> : <Sun size={28} />}
            </button>
          </div>
          
          <div className="content" style={{paddingBottom: '80px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{fontSize: '1.4rem'}}>Histórico Completo</h2>
              <span className="badge" style={{backgroundColor: 'var(--border-color)', color: 'var(--text-color)'}}>{inspecoes.length} Registros</span>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {renderInspectionList(inspecoes)}
            </div>
          </div>
          {renderBottomNav()}
        </>
      )}

      {currentScreen === 'inspection' && (
        <>
          <div className="header">
            <button className="btn-large btn-icon-only" onClick={() => setCurrentScreen('home')} style={{backgroundColor: 'transparent', width: 'auto'}}>
              <ArrowLeft size={32} />
            </button>
            <h1 style={{fontSize: '1.4rem'}}>Pneu: {pneuId || '___'}</h1>
            <div style={{width: 32}}></div>
          </div>
          
          <div className="content" style={{overflowY: 'auto', paddingBottom: '100px'}}>
            
            {!isIdConfirmed ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', justifyContent: 'center'}}>
                <div className="input-group">
                  <span className="input-label text-center" style={{color: 'var(--text-color)'}}>Digite o ID do Pneu</span>
                  <input type="text" className="input-large" value={pneuId} readOnly />
                </div>
                
                <div className="numpad">
                  {[1,2,3,4,5,6,7,8,9,'C',0,'<'].map(num => (
                    <button key={num} className="numpad-btn" onClick={() => handleNumpad(num)}>
                      {num}
                    </button>
                  ))}
                </div>
                <button className="btn-large btn-primary" onClick={() => {
                  setIsIdConfirmed(true);
                }}>
                  Continuar
                </button>
              </div>
            ) : (
              <>
                <h2 style={{marginBottom: '10px', color: 'var(--text-color)'}}>Checklist de Inspeção</h2>
                
                {['banda_rodagem', 'flanco', 'talao'].map(item => (
                  <div key={item} className="checklist-item">
                    <div className="checklist-header">
                      <span className="checklist-title">
                        {item === 'banda_rodagem' ? 'Banda de Rodagem' : item === 'flanco' ? 'Flanco' : 'Talão'}
                      </span>
                      <div className="checklist-actions">
                        <button 
                          className={`btn-large btn-icon-only ${checklist[item] === true ? 'btn-success' : ''}`}
                          style={{border: checklist[item] !== true ? '2px solid var(--border-color)' : 'none', backgroundColor: checklist[item] === true ? 'var(--success-color)' : 'transparent'}}
                          onClick={() => handleCheck(item, true)}
                        >
                          <CheckCircle size={32} color={checklist[item] === true ? 'white' : '#888'} />
                        </button>
                        <button 
                          className={`btn-large btn-icon-only ${checklist[item] === false ? 'btn-danger' : ''}`}
                          style={{border: checklist[item] !== false ? '2px solid var(--border-color)' : 'none', backgroundColor: checklist[item] === false ? 'var(--danger-color)' : 'transparent'}}
                          onClick={() => handleCheck(item, false)}
                        >
                          <XCircle size={32} color={checklist[item] === false ? 'white' : '#888'} />
                        </button>
                      </div>
                    </div>
                    
                    {checklist[item] === false && (
                      <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <button className="btn-large" style={{backgroundColor: 'var(--border-color)', color: 'var(--text-color)'}} onClick={() => {
                          setFalhasDetail(prev => ({...prev, [item]: 'Foto tirada'}))
                        }}>
                          <Camera size={24} /> {falhasDetail[item] === 'Foto tirada' ? 'Foto Capturada ✔' : 'Tirar Foto do Defeito'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                <div style={{
                  position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '100%', maxWidth: '480px', padding: '20px',
                  backgroundColor: 'var(--bg-color)', borderTop: '1px solid var(--border-color)',
                  zIndex: 10
                }}>
                  <button 
                    className={`btn-large ${canSave ? 'btn-primary' : 'btn-disabled'}`} 
                    onClick={saveInspection}
                    disabled={!canSave}
                  >
                    <Save size={28} />
                    SALVAR INSPEÇÃO
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
