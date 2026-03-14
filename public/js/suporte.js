const clientes = [

{
nome:"Empresa Alpha",
cnpj:"12.345.678/0001-00",
anydesk:"123456789",
team:"987654321"
},

{
nome:"Empresa Beta",
cnpj:"98.765.432/0001-10",
anydesk:"456789123",
team:"321654987"
}

]

function carregarClientes(){

const lista=document.getElementById("listaClientes")

lista.innerHTML=""

clientes.forEach(cliente=>{

lista.innerHTML+=`

<div class="cliente-card">

<div class="cliente-nome">${cliente.nome}</div>

<div class="cliente-info">CNPJ: ${cliente.cnpj}</div>

<div class="acesso-box">

<div>ID AnyDesk: ${cliente.anydesk}</div>
<div>ID TeamViewer: ${cliente.team}</div>

</div>

<div class="acoes">

<button class="btn-acesso btn-anydesk"
onclick="copiar('${cliente.anydesk}')">
Copiar AnyDesk
</button>

<button class="btn-acesso btn-team"
onclick="copiar('${cliente.team}')">
Copiar TeamViewer
</button>

</div>

</div>

`

})

}

function copiar(texto){

navigator.clipboard.writeText(texto)

alert("Copiado!")

}

function filtrarClientes(){

let busca=document.getElementById("buscar").value.toLowerCase()

let cards=document.querySelectorAll(".cliente-card")

cards.forEach(card=>{

let nome=card.querySelector(".cliente-nome").innerText.toLowerCase()

card.style.display=nome.includes(busca) ? "flex":"none"

})

}