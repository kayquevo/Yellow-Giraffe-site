const formLogin = document.getElementById('formLogin');
const msgDiv = document.getElementById('msg');
const API_URL = 'http://localhost:5000/api';

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