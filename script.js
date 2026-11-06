const btnSair = document.getElementById('btnSair');
if (btnSair) {
  btnSair.addEventListener('click', () => {
    // Remove o token da sessão
    sessionStorage.removeItem('token');
    // Redireciona pro login
    window.location.href = 'login.html';
  });
}

/* =====================================================
   CONTROLE DE ACESSO POR CARGO (RBAC)
===================================================== */
let cargoAtual = sessionStorage.getItem("cargo") || "Cozinheiro";

const regrasAcesso = {
    "Gerente": {
        abasPermitidas: ["dashboard", "estoque", "funcionarios", "controle"],
        verValoresEstoque: true,
        editarEstoque: true
    },
    "Copeiro": {
        abasPermitidas: ["dashboard", "estoque", "controle"],
        verValoresEstoque: false,
        editarEstoque: true
    },
    "Cozinheiro": {
        abasPermitidas: ["dashboard", "estoque", "controle"],
        verValoresEstoque: false,
        editarEstoque: false
    },
    "Garçom": {
        abasPermitidas: ["dashboard", "controle"],
        verValoresEstoque: false,
        editarEstoque: false
    }
};

function trocarCargo(novoCargo) {
    cargoAtual = novoCargo;
    localStorage.setItem("yg_cargo_ativo", novoCargo);
    aplicarPermissoes();
}

function aplicarPermissoes() {
    const regras = regrasAcesso[cargoAtual] || regrasAcesso["Cozinheiro"];

    // Atualiza a visualização do cargo
    const selectCargo = document.getElementById("cargoAtivo");
    if (selectCargo) {
        selectCargo.value = cargoAtual;
        selectCargo.disabled = true; // Desabilita o select para o usuário não burlar o próprio cargo
    }

    // 1. Controle das Abas do Menu
    document.querySelectorAll(".portal-tab-btn").forEach(btn => {
        const idAba = btn.getAttribute("onclick").match(/'([^']+)'/)[1];
        btn.style.display = regras.abasPermitidas.includes(idAba) ? "" : "none";
    });

    // 2. Controle dos Cards de atalho no Dashboard
    document.querySelectorAll("#dashboard .card-dark-custom").forEach(card => {
        const idAba = card.getAttribute("onclick").match(/'([^']+)'/)[1];
        const coluna = card.closest(".col-md-4");
        if (coluna) {
            coluna.style.display = regras.abasPermitidas.includes(idAba) ? "" : "none";
        }
    });

    // 3. Controle do Formulário de Cadastro do Estoque
    const formEstoque = document.querySelector("#estoque .form-custom");
    if (formEstoque) {
        formEstoque.style.display = regras.editarEstoque ? "" : "none";
    }

    // 4. Controle do campo Preço Unitário no cadastro
    const inputPreco = document.getElementById("preco");
    if (inputPreco) {
        const colunaPreco = inputPreco.closest(".col-md-3");
        if (colunaPreco) {
            colunaPreco.style.display = regras.verValoresEstoque ? "" : "none";
        }
    }

    // 5. Card de Valor Estimado no topo do Estoque
    const cardValorEstimado = document.getElementById("valorTotal");
    if (cardValorEstimado) {
        const colunaValor = cardValorEstimado.closest(".col-md-4");
        if (colunaValor) {
            colunaValor.style.display = regras.verValoresEstoque ? "" : "none";
        }
    }

    // Se estiver em uma tela proibida para o cargo, redireciona para a tela inicial
    const telaAtiva = document.querySelector(".portal-tela.ativa");
    if (telaAtiva && !regras.abasPermitidas.includes(telaAtiva.id)) {
        selecionarAba("dashboard");
    }

    carregarEstoque();
}

    /* NAVEGAÇÃO ENTRE TELAS */
function mostrarTela(id, elementoBtn){
    document.querySelectorAll(".portal-tela").forEach(t => t.classList.remove("ativa"));
    document.querySelectorAll(".portal-tab-btn").forEach(b => b.classList.remove("active"));

    const tela = document.getElementById(id);
    if(tela) tela.classList.add("ativa");

    if(elementoBtn){
        elementoBtn.classList.add("active");
    }

    // Se navegou para a tela de estoque, busca os dados da API na hora
    if (id === 'estoque') {
        carregarEstoque();
    }

    if (id === 'funcionarios') {
        carregarFuncionarios();
    }
}

    function selecionarAba(id){
        const botoes = document.querySelectorAll(".portal-tab-btn");
        botoes.forEach(btn => {
            if(btn.getAttribute("onclick").includes(id)){
                btn.click();
            }
        });
    }

    /* RELÓGIO DIGITAL */
    function atualizarRelogio(){
        const agora = new Date();
        const data = agora.toLocaleDateString();
        const hora = agora.toLocaleTimeString();
        document.getElementById("relogio").innerText = `${data} • ${hora}`;
    }
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();

    /* =====================================================
       CONTROLE DE PONTO (PERSISTÊNCIA COMPLETA)
    ===================================================== */
    let registrosPonto = JSON.parse(localStorage.getItem("yg_ponto")) || [];

    function registrar(tipo){
        const nome = document.getElementById("nomePonto").value.trim();
        const funcao = document.getElementById("funcaoPonto").value.trim();

        if(!nome){
            alert("Informe o nome do funcionário!");
            return;
        }

        const agora = new Date();
        const dataAtual = agora.toLocaleDateString();
        const horaAtual = agora.toLocaleTimeString();

        if(tipo === "entrada"){
            registrosPonto.push({
                nome,
                funcao: funcao || "Geral",
                data: dataAtual,
                entrada: horaAtual,
                saida: "",
                total: ""
            });
        } else if(tipo === "saida"){
            let encontrado = false;
            for(let i = registrosPonto.length - 1; i >= 0; i--){
                if(registrosPonto[i].nome.toLowerCase() === nome.toLowerCase() && !registrosPonto[i].saida){
                    registrosPonto[i].saida = horaAtual;
                    registrosPonto[i].total = calcularHoras(registrosPonto[i].entrada, horaAtual);
                    encontrado = true;
                    break;
                }
            }
            if(!encontrado){
                alert("Nenhuma entrada em aberto encontrada para este funcionário.");
                return;
            }
        }

        localStorage.setItem("yg_ponto", JSON.stringify(registrosPonto));
        renderizarPonto();
    }

    function calcularHoras(entrada, saida){
        const [h1, m1, s1] = entrada.split(":").map(Number);
        const [h2, m2, s2] = saida.split(":").map(Number);
        const inicio = new Date(0, 0, 0, h1, m1, s1);
        const fim = new Date(0, 0, 0, h2, m2, s2);
        const diff = (fim - inicio) / 1000 / 60 / 60;
        return diff.toFixed(2) + "h";
    }

    function deletarPonto(index){
        registrosPonto.splice(index, 1);
        localStorage.setItem("yg_ponto", JSON.stringify(registrosPonto));
        renderizarPonto();
    }

    function renderizarPonto(){
        const tabela = document.getElementById("tabelaPonto");
        tabela.innerHTML = "";

        if(registrosPonto.length === 0){
            tabela.innerHTML = `<tr><td colspan="7" class="text-secondary py-3">Nenhum ponto registrado hoje.</td></tr>`;
            return;
        }

        registrosPonto.forEach((r, i) => {
            tabela.innerHTML += `
                <tr>
                    <td>${r.nome}</td>
                    <td>${r.funcao}</td>
                    <td>${r.data}</td>
                    <td>${r.entrada}</td>
                    <td>${r.saida || '<span class="badge bg-warning text-dark">Em aberto</span>'}</td>
                    <td>${r.total || '-'}</td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletarPonto(${i})">Excluir</button>
                    </td>
                </tr>
            `;
        });
    }

    /* =====================================================
    CONTROLE DE ESTOQUE (INTEGRADO COM A API MYSQL)
    ===================================================== */
const API_URL = 'http://localhost:5000/api';

// 1. LISTAR PRODUTOS (GET)
async function carregarEstoque() {
    const token = sessionStorage.getItem('token');
    const tabela = document.getElementById("tabelaProdutos");
    const thead = document.querySelector("#estoque thead tr");
    if (!tabela || !thead) return;

    try {
        const resposta = await fetch(`${API_URL}/estoque`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (resposta.status === 401 || resposta.status === 403) {
            tabela.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Acesso não autorizado para o seu cargo.</td></tr>`;
            return;
        }

        const produtos = await resposta.json();
        renderizarTabelaEstoque(produtos);

    } catch (erro) {
        console.error("Erro ao carregar estoque:", erro);
        tabela.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Erro ao conectar com o servidor.</td></tr>`;
    }
}

// 2. RENDERIZAR TABELA E CARDS
function renderizarTabelaEstoque(produtos) {
    const regras = regrasAcesso[cargoAtual] || regrasAcesso["Cozinheiro"];
    const tabela = document.getElementById("tabelaProdutos");
    const thead = document.querySelector("#estoque thead tr");

    tabela.innerHTML = "";

    // Cabeçalho adaptado ao cargo
    let cabecalhoHtml = `
        <th>Produto</th>
        <th>Categoria</th>
        <th>Qtd</th>
    `;
    if (regras.verValoresEstoque) {
        cabecalhoHtml += `
            <th>Preço Unit.</th>
            <th>Subtotal</th>
        `;
    }
    cabecalhoHtml += `<th>Status</th>`;
    if (regras.editarEstoque) {
        cabecalhoHtml += `<th>Ações</th>`;
    }
    thead.innerHTML = cabecalhoHtml;

    let baixo = 0;
    let valorTotal = 0;
    const totalColunas = 3 + (regras.verValoresEstoque ? 2 : 0) + (regras.editarEstoque ? 1 : 0);

    if (!produtos || produtos.length === 0) {
        tabela.innerHTML = `<tr><td colspan="${totalColunas}" class="text-secondary py-3">Nenhum produto cadastrado no estoque.</td></tr>`;
        atualizarCardsEstoque(0, 0, 0, regras.verValoresEstoque);
        return;
    }

    produtos.forEach((item) => {
        const qtd = Number(item.quantidade) || 0;
        const preco = item.preco_unitario !== undefined ? Number(item.preco_unitario) : 0;
        const subtotal = qtd * preco;

        if (qtd <= (item.estoque_minimo || 5)) baixo++;
        valorTotal += subtotal;

        let linha = `
            <tr>
                <td class="fw-bold text-start ps-3">${item.nome_produto}</td>
                <td>${item.categoria || '-'}</td>
                <td>${qtd} ${item.unidade_medida || 'un'}</td>
        `;

        if (regras.verValoresEstoque) {
            linha += `
                <td>R$ ${preco.toFixed(2)}</td>
                <td>R$ ${subtotal.toFixed(2)}</td>
            `;
        }

        linha += `<td>${getBadgeStatus(qtd)}</td>`;

        if (regras.editarEstoque) {
            linha += `
                <td>
                    <button class="btn btn-outline-warning btn-sm me-1" onclick="editarProduto(${item.id_produto}, '${item.nome_produto}', ${qtd}, ${preco})">✏️</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deletarProduto(${item.id_produto})">🗑️</button>
                </td>
            `;
        }

        linha += `</tr>`;
        tabela.innerHTML += linha;
    });

    atualizarCardsEstoque(produtos.length, baixo, valorTotal, regras.verValoresEstoque);
}

function atualizarCardsEstoque(total, baixo, valorTotal, podeVerValores) {
    const elTotal = document.getElementById("totalProdutos");
    const elBaixo = document.getElementById("baixoEstoque");
    const elValorTotal = document.getElementById("valorTotal");

    if (elTotal) elTotal.innerText = total;
    if (elBaixo) elBaixo.innerText = baixo;
    if (elValorTotal && podeVerValores) {
        elValorTotal.innerText = `R$ ${valorTotal.toFixed(2)}`;
    }
}

// 3. ADICIONAR PRODUTO (POST)
async function adicionarProduto() {
    const token = sessionStorage.getItem('token');
    const nome_produto = document.getElementById("produto").value.trim();
    const quantidade = document.getElementById("quantidade").value;
    const preco = document.getElementById("preco").value;
    const categoriaSelect = document.getElementById("categoria");
    const id_categoria_produto = categoriaSelect ? categoriaSelect.value : "";

    // Validação inicial no front-end
    if (!nome_produto || !quantidade || !id_categoria_produto) {
        alert("Preencha o nome, quantidade e selecione uma categoria válida!");
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/estoque`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nome_produto: nome_produto,
                id_categoria_produto: parseInt(id_categoria_produto, 10),
                quantidade: parseInt(quantidade, 10),
                preco_unitario: preco ? parseFloat(preco) : 0.0,
                unidade_medida: "un",
                estoque_minimo: 5
            })
        });

        if (!resposta.ok) {
            const erro = await resposta.json();
            alert(erro.erro || "Falha ao cadastrar produto no estoque.");
            return;
        }

        limparCamposEstoque();
        carregarEstoque();

    } catch (erro) {
        console.error("Erro ao adicionar produto:", erro);
        alert("Erro de conexão ao cadastrar produto.");
    }
}

// 4. ATUALIZAR PRODUTO (PUT)
async function editarProduto(id_produto, nomeAtual, qtdAtual, precoAtual) {
    const token = sessionStorage.getItem('token');
    const novoNome = prompt("Nome do produto:", nomeAtual);
    const novaQtd = prompt("Quantidade em estoque:", qtdAtual);
    const novoPreco = prompt("Preço unitário (R$):", precoAtual);

    if (novoNome === null || novaQtd === null) return;

    try {
        const resposta = await fetch(`${API_URL}/estoque/${id_produto}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nome_produto: novoNome,
                id_categoria_produto: 1, // mantém categoria base
                quantidade: Number(novaQtd),
                preco_unitario: novoPreco ? Number(novoPreco) : 0,
                unidade_medida: "un",
                estoque_minimo: 5
            })
        });

        if (!resposta.ok) {
            alert("Não foi possível atualizar o produto.");
            return;
        }

        carregarEstoque();

    } catch (erro) {
        console.error("Erro ao atualizar produto:", erro);
        alert("Erro de conexão ao atualizar.");
    }
}

// 5. DELETAR PRODUTO (DELETE)
async function deletarProduto(id_produto) {
    if (!confirm("Remover este item do estoque?")) return;

    const token = sessionStorage.getItem('token');

    try {
        const resposta = await fetch(`${API_URL}/estoque/${id_produto}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!resposta.ok) {
            alert("Não foi possível excluir o produto.");
            return;
        }

        carregarEstoque();

    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        alert("Erro de conexão ao excluir.");
    }
}

function limparCamposEstoque() {
    document.getElementById("produto").value = "";
    document.getElementById("quantidade").value = "";
    document.getElementById("preco").value = "";
    document.getElementById("categoria").value = "";
}

function getBadgeStatus(qtd) {
    if (qtd <= 5) return `<span class="badge-baixo">CRÍTICO</span>`;
    if (qtd <= 15) return `<span class="badge-medio">ATENÇÃO</span>`;
    return `<span class="badge-alto">OK</span>`;
}

    /* =====================================================
       CADASTRO DE FUNCIONÁRIOS (COM LOCALSTORAGE)
    ===================================================== */
    /* =====================================================
   EQUIPE & FUNCIONÁRIOS (INTEGRADO COM A API MYSQL)
===================================================== */

// 1. CARREGAR FUNCIONÁRIOS DA API (GET)
async function carregarFuncionarios() {
    const token = sessionStorage.getItem('token');
    const tabela = document.getElementById("tabelaFuncionarios");
    if (!tabela) return;

    try {
        const resposta = await fetch(`${API_URL}/funcionarios`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (resposta.status === 403 || resposta.status === 401) {
            tabela.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Acesso restrito à Gerência.</td></tr>`;
            return;
        }

        const funcs = await resposta.json();
        renderizarTabelaFuncionarios(funcs);

    } catch (erro) {
        console.error("Erro ao carregar colaboradores:", erro);
        tabela.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Erro ao conectar com o servidor.</td></tr>`;
    }
}

// 2. RENDERIZAR TABELA
function renderizarTabelaFuncionarios(funcs) {
    const tabela = document.getElementById("tabelaFuncionarios");
    if (!tabela) return;

    tabela.innerHTML = "";

    if (!funcs || funcs.length === 0) {
        tabela.innerHTML = `<tr><td colspan="6" class="text-secondary py-3">Nenhum funcionário encontrado.</td></tr>`;
        return;
    }

    funcs.forEach((f) => {
        const badgeStatus = f.status === "Ativo" 
            ? '<span class="badge bg-success">Ativo</span>' 
            : '<span class="badge bg-secondary">Desativado</span>';

        const salarioTexto = (f.salario !== undefined && f.salario !== null && f.salario !== "")
            ? `R$ ${Number(f.salario).toFixed(2)}`
            : '<span class="text-muted">Não informado</span>';

        tabela.innerHTML += `
            <tr>
                <td class="text-start ps-3 fw-bold">${f.nome}</td>
                <td>${f.nome_cargo || '-'}</td>
                <td>${f.telefone || '-'}</td>
                <td>${salarioTexto}</td>
                <td>${badgeStatus}</td>
                <td>
                    <button class="btn btn-outline-warning btn-sm me-1" onclick="editarFuncionarioPrompt(${f.id_funcionario}, '${f.nome}', '${f.nome_cargo}', '${f.telefone || ''}', ${f.salario || 0}, '${f.status}')">✏️</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deletarFuncionarioAPI(${f.id_funcionario})">🗑️</button>
                </td>
            </tr>
        `;
    });
}

// 3. ADICIONAR FUNCIONÁRIO (POST)
async function cadastrarFuncionarioPainel() {
    const token = sessionStorage.getItem('token');
    const nome = document.getElementById("nomeFuncionario").value.trim();
    const cargoSelect = document.getElementById("cargoFuncionario");
    const cargo = cargoSelect ? cargoSelect.value : "";
    const telefone = document.getElementById("telefone").value.trim();
    const salario = document.getElementById("salario").value;
    const status = document.getElementById("status").value;

    if (!nome || !cargo) {
        alert("Preencha o Nome e selecione o Cargo do colaborador!");
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/funcionarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nome: nome,
                cargo: cargo,
                telefone: telefone || null,
                salario: salario ? parseFloat(salario) : null,
                status: status
            })
        });

        if (!resposta.ok) {
            const erro = await resposta.json();
            alert(erro.erro || "Falha ao cadastrar colaborador.");
            return;
        }

        limparCamposFuncionario();
        carregarFuncionarios();

    } catch (erro) {
        console.error("Erro ao cadastrar funcionário:", erro);
        alert("Erro de conexão ao cadastrar colaborador.");
    }
}

// 4. ATUALIZAR FUNCIONÁRIO (PUT)
async function editarFuncionarioPrompt(id, nomeAtual, cargoAtual, telAtual, salAtual, statusAtual) {
    const token = sessionStorage.getItem('token');
    const novoNome = prompt("Nome completo:", nomeAtual);
    const novoCargo = prompt("Cargo (Gerente, Copeiro, Cozinheiro, Garçom):", cargoAtual);
    const novoTel = prompt("Telefone:", telAtual);
    const novoSal = prompt("Salário (R$):", salAtual);

    if (novoNome === null || novoCargo === null) return;

    try {
        const resposta = await fetch(`${API_URL}/funcionarios/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nome: novoNome,
                cargo: novoCargo,
                telefone: novoTel || null,
                salario: novoSal ? parseFloat(novoSal) : null,
                status: statusAtual
            })
        });

        if (!resposta.ok) {
            alert("Não foi possível atualizar os dados do colaborador.");
            return;
        }

        carregarFuncionarios();

    } catch (erro) {
        console.error("Erro ao atualizar colaborador:", erro);
        alert("Erro de conexão ao atualizar.");
    }
}

// 5. REMOVER OU DESATIVAR FUNCIONÁRIO (DELETE)
async function deletarFuncionarioAPI(id) {
    if (!confirm("Tem a certeza de que deseja remover este colaborador?")) return;

    const token = sessionStorage.getItem('token');

    try {
        const resposta = await fetch(`${API_URL}/funcionarios/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!resposta.ok) {
            alert("Não foi possível remover o colaborador.");
            return;
        }

        carregarFuncionarios();

    } catch (erro) {
        console.error("Erro ao excluir colaborador:", erro);
        alert("Erro de conexão ao excluir.");
    }
}

function limparCamposFuncionario() {
    document.getElementById("nomeFuncionario").value = "";
    if (document.getElementById("cargoFuncionario")) {
        document.getElementById("cargoFuncionario").value = "";
    }
    document.getElementById("telefone").value = "";
    document.getElementById("salario").value = "";
    document.getElementById("status").value = "Ativo";
}

    /* INICIALIZAÇÃO */
    aplicarPermissoes();
    renderizarPonto();
    carregarEstoque();
    carregarFuncionarios();