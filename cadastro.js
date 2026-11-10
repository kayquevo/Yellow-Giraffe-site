const formCadastro = document.getElementById('formCadastro');
const msgDiv = document.getElementById('msg');
// Se o site for aberto direto do disco (file://) ou por um servidor estático local
// (ex: Live Server, porta 5500), fala com o Flask em localhost:5000. Quando o site é
// servido pelo próprio Flask (local em :5000 ou no PythonAnywhere), usa o caminho relativo.
const API_URL = (location.protocol === 'file:' || location.port === '5500')
    ? 'http://localhost:5000/api'
    : '/api';

formCadastro.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const senha2 = document.getElementById('senha2').value;
  const cargo = document.getElementById('cargo').value;

  if (senha !== senha2) {
    msgDiv.className = 'small mb-2 text-danger';
    msgDiv.textContent = 'As senhas não coincidem!';
    return;
  }

  msgDiv.className = 'small mb-2 text-info';
  msgDiv.textContent = 'Cadastrando funcionário...';

  try {
    const resposta = await fetch(`${API_URL}/cadastro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome: nome,
        email: email,
        senha: senha,
        cargo: cargo
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      msgDiv.className = 'small mb-2 text-danger';
      msgDiv.textContent = dados.erro || 'Falha ao cadastrar.';
      return;
    }

    msgDiv.className = 'small mb-2 text-success';
    msgDiv.textContent = 'Cadastro realizado com sucesso! Redirecionando para login...';

    formCadastro.reset();
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);

  } catch (erro) {
    console.error('Erro na requisição:', erro);
    msgDiv.className = 'small mb-2 text-danger';
    msgDiv.textContent = 'Erro ao conectar com o servidor. O backend está rodando?';
  }
});