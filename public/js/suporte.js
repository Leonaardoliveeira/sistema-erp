const clientes = [

{
nome:"Empresa Alpha",
cnpj:"12.345.678/0001-00",
anydesk:"123456789"
},

{
nome:"Empresa Beta",
cnpj:"98.765.432/0001-10",
anydesk:"987654321"
}

]

function carregarClientes(){

const lista = document.getElementById("listaClientes")

lista.innerHTML=""

clientes.forEach(cliente=>{

lista.innerHTML+=`

<div class="cliente-card">

<div class="cliente-nome">${cliente.nome}</div>

<div class="cliente-cnpj">${cliente.cnpj}</div>

<div class="anydesk-id">

AnyDesk ID: ${cliente.anydesk}

</div>

<div class="acoes">

<button class="btn-anydesk"
onclick="abrirAnyDesk('${cliente.anydesk}')">

Abrir AnyDesk

</button>

<button class="btn-copiar"
onclick="copiar('${cliente.anydesk}')">

Copiar

</button>

</div>

</div>

`

})

}

function abrirAnyDesk(id){

window.location.href = "anydesk:"+id

}

function copiar(texto){

navigator.clipboard.writeText(texto)

alert("ID copiado!")

}

function filtrarClientes(){

let busca = document.getElementById("buscar").value.toLowerCase()

let cards = document.querySelectorAll(".cliente-card")

cards.forEach(card=>{

let nome = card.querySelector(".cliente-nome").innerText.toLowerCase()

card.style.display = nome.includes(busca) ? "flex" : "none"

})

}