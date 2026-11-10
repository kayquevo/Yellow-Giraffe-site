const formLogin = document.getElementById('formLogin');
const msgDiv = document.getElementById('msg');
// Se o site for aberto direto do disco (file://) ou por um servidor estático local
// (ex: Live Server, porta 5500), fala com o Flask em localhost:5000. Quando o site é
// servido pelo próprio Flask (local em :5000 ou no PythonAnywhere), usa o caminho relativo.
const API_URL = (location.protocol === 'file:' || location.port === '5500')
    ? 'http://localhost:5000/api'
    : '/api';

formLogin.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  msgDiv.className = 'small mb-2 text-info';
  msgDiv.textContent = 'Autenticando...';

  try {
    const resposta = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      msgDiv.className = 'small mb-2 text-danger';
      msgDiv.textContent = dados.erro || 'Falha ao autenticar.';
      return;
    }

    // Salva apenas o token no sessionStorage
    sessionStorage.setItem('token', dados.token);
    sessionStorage.setItem('cargo', dados.cargo);
    sessionStorage.setItem('nomeUsuario', dados.nome);

    msgDiv.className = 'small mb-2 text-success';
    msgDiv.textContent = 'Login realizado! Redirecionando...';

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (erro) {
    console.error('Erro na requisição:', erro);
    msgDiv.className = 'small mb-2 text-danger';
    msgDiv.textContent = 'Erro ao conectar ao servidor. O backend está rodando?';
  }
});