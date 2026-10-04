
/* =====================================================
   CONTROLE DE ACESSO POR CARGO (RBAC)
===================================================== */
let cargoAtual = localStorage.getItem("yg_cargo_ativo") || "Gerente";

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
    }
};

function trocarCargo(novoCargo) {
    cargoAtual = novoCargo;
    localStorage.setItem("yg_cargo_ativo", novoCargo);
    aplicarPermissoes();
}

function aplicarPermissoes() {
    const regras = regrasAcesso[cargoAtual];

    // Sincroniza o select do topo se existir
    const selectCargo = document.getElementById("cargoAtivo");
    if (selectCargo) selectCargo.value = cargoAtual;

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

    // 3. Controle do Formulário de Cadastro do Estoque (Cozinheiro não cadastra)
    const formEstoque = document.querySelector("#estoque .form-custom");
    if (formEstoque) {
        formEstoque.style.display = regras.editarEstoque ? "" : "none";
    }

    // 4. Controle do campo "Preço Unitário" no cadastro (Copeiro não cadastra preço)
    const inputPreco = document.getElementById("preco");
    if (inputPreco) {
        const colunaPreco = inputPreco.closest(".col-md-3");
        if (colunaPreco) {
            colunaPreco.style.display = regras.verValoresEstoque ? "" : "none";
        }
    }

    // 5. Card de "Valor Estimado" no topo do Estoque (oculta para Copeiro e Cozinheiro)
    const cardValorEstimado = document.getElementById("valorTotal");
    if (cardValorEstimado) {
        const colunaValor = cardValorEstimado.closest(".col-md-4");
        if (colunaValor) {
            colunaValor.style.display = regras.verValoresEstoque ? "" : "none";
        }
    }

    // Se estiver em uma tela proibida (ex: Funcionários sendo Copeiro), volta para o dashboard
    const telaAtiva = document.querySelector(".portal-tela.ativa");
    if (telaAtiva && !regras.abasPermitidas.includes(telaAtiva.id)) {
        selecionarAba("dashboard");
    }

    // Re-renderiza a tabela de estoque aplicando as colunas visíveis
    renderizarEstoque();
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
       CONTROLE DE ESTOQUE
    ===================================================== */
    let estoque = JSON.parse(localStorage.getItem("yg_estoque")) || [];

    function adicionarProduto(){
        const produto = document.getElementById("produto").value.trim();
        const quantidade = document.getElementById("quantidade").value;
        const preco = document.getElementById("preco").value;
        const categoria = document.getElementById("categoria").value;

        if(!produto || !quantidade || !categoria){
            alert("Preencha todos os campos do produto!");
            return;
        }

        estoque.push({
            produto,
            quantidade: Number(quantidade),
            preco: Number(preco),
            categoria
        });

        localStorage.setItem("yg_estoque", JSON.stringify(estoque));
        limparCamposEstoque();
        renderizarEstoque();
    }

    function limparCamposEstoque(){
        document.getElementById("produto").value = "";
        document.getElementById("quantidade").value = "";
        document.getElementById("preco").value = "";
        document.getElementById("categoria").value = "";
    }

    function getBadgeStatus(qtd){
        if(qtd <= 5) return `<span class="badge-baixo">CRÍTICO</span>`;
        if(qtd <= 15) return `<span class="badge-medio">ATENÇÃO</span>`;
        return `<span class="badge-alto">OK</span>`;
    }

    function renderizarEstoque(){
        const tabela = document.getElementById("tabelaProdutos");
        tabela.innerHTML = "";

        let baixo = 0;
        let valorTotal = 0;

        if(estoque.length === 0){
            tabela.innerHTML = `<tr><td colspan="7" class="text-secondary py-3">Nenhum produto cadastrado no estoque.</td></tr>`;
        }

        estoque.forEach((item, index) => {
            if(item.quantidade <= 5) baixo++;
            const totalItem = item.quantidade * item.preco;
            valorTotal += totalItem;

            tabela.innerHTML += `
                <tr>
                    <td class="fw-bold text-start ps-3">${item.produto}</td>
                    <td>${item.categoria}</td>
                    <td>${item.quantidade}</td>
                    <td>R$ ${item.preco.toFixed(2)}</td>
                    <td>R$ ${totalItem.toFixed(2)}</td>
                    <td>${getBadgeStatus(item.quantidade)}</td>
                    <td>
                        <button class="btn btn-outline-warning btn-sm me-1" onclick="editarProduto(${index})">✏️</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletarProduto(${index})">🗑️</button>
                    </td>
                </tr>
            `;
        });

        document.getElementById("totalProdutos").innerText = estoque.length;
        document.getElementById("baixoEstoque").innerText = baixo;
        document.getElementById("valorTotal").innerText = `R$ ${valorTotal.toFixed(2)}`;
    }

    function deletarProduto(index){
        if(confirm("Remover este item do estoque?")){
            estoque.splice(index, 1);
            localStorage.setItem("yg_estoque", JSON.stringify(estoque));
            renderizarEstoque();
        }
    }

    function editarProduto(index){
        const item = estoque[index];
        const novoNome = prompt("Nome do produto:", item.produto);
        const novaQtd = prompt("Quantidade em estoque:", item.quantidade);
        const novoPreco = prompt("Preço unitário (R$) - Opcional:", item.preco || 0);
        if(novoNome !== null && novaQtd !== null && novoPreco !== null){
            estoque[index].produto = novoNome;
            estoque[index].quantidade = Number(novaQtd);
            estoque[index].preco = novoPreco ? Number(novoPreco) : 0;
            localStorage.setItem("yg_estoque", JSON.stringify(estoque));
            renderizarEstoque();
        }
    }

    /* =====================================================
       CADASTRO DE FUNCIONÁRIOS (COM LOCALSTORAGE)
    ===================================================== */
    let funcionarios = JSON.parse(localStorage.getItem("yg_funcionarios")) || [];

    function cadastrarFuncionario(){
        const nome = document.getElementById("nomeFuncionario").value.trim();
        const cargo = document.getElementById("cargo").value.trim();
        const telefone = document.getElementById("telefone").value.trim();
        const salario = document.getElementById("salario").value;
        const status = document.getElementById("status").value;

        if(!nome || !cargo || !telefone || !salario){
            alert("Preencha todos os campos do funcionário!");
            return;
        }

        funcionarios.push({
            nome,
            cargo,
            telefone,
            salario: Number(salario),
            status
        });

        localStorage.setItem("yg_funcionarios", JSON.stringify(funcionarios));
        limparCamposFuncionario();
        renderizarFuncionarios();
    }

    function limparCamposFuncionario(){
        document.getElementById("nomeFuncionario").value = "";
        document.getElementById("cargo").value = "";
        document.getElementById("telefone").value = "";
        document.getElementById("salario").value = "";
        document.getElementById("status").value = "Ativo";
    }

    function deletarFuncionario(index){
        if(confirm("Deseja excluir este colaborador?")){
            funcionarios.splice(index, 1);
            localStorage.setItem("yg_funcionarios", JSON.stringify(funcionarios));
            renderizarFuncionarios();
        }
    }

    function renderizarFuncionarios(){
        const tabela = document.getElementById("tabelaFuncionarios");
        tabela.innerHTML = "";

        if(funcionarios.length === 0){
            tabela.innerHTML = `<tr><td colspan="6" class="text-secondary py-3">Nenhum funcionário cadastrado.</td></tr>`;
            return;
        }

        funcionarios.forEach((f, i) => {
            const badgeStatus = f.status === "Ativo" 
                ? '<span class="badge bg-success">Ativo</span>' 
                : '<span class="badge bg-secondary">Desativado</span>';

            tabela.innerHTML += `
                <tr>
                    <td class="text-start ps-3 fw-bold">${f.nome}</td>
                    <td>${f.cargo}</td>
                    <td>${f.telefone}</td>
                    <td>R$ ${f.salario.toFixed(2)}</td>
                    <td>${badgeStatus}</td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletarFuncionario(${i})">Excluir</button>
                    </td>
                </tr>
            `;
        });
    }

    /* INICIALIZAÇÃO */
    renderizarPonto();
    renderizarEstoque();
    renderizarFuncionarios();