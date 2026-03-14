function getToken(){
return localStorage.getItem("token")
}

async function carregarClientes(){

const lista = document.getElementById("listaClientes")

if(!lista) return

lista.innerHTML=""

try{

const response = await fetch("/api/clientes",{
headers:{
"Authorization":"Bearer "+getToken()
}
})

const clientes = await response.json()

clientes.forEach(cliente=>{

if(!cliente.acessosRemotos || cliente.acessosRemotos.length === 0) return

let acessosHTML = ""

cliente.acessosRemotos.forEach(acesso=>{

if(!acesso.anydesk) return

acessosHTML += `

<div class="acesso-item">

<div class="anydesk-id">
${acesso.nome || "Computador"} - AnyDesk: ${acesso.anydesk}
</div>

<div class="acoes">

<button class="btn-anydesk"
onclick="abrirAnyDesk('${acesso.anydesk}')">
Abrir
</button>

<button class="btn-copiar"
onclick="copiar('${acesso.anydesk}')">
Copiar
</button>

</div>

</div>

`

})

lista.innerHTML += `

<div class="cliente-card">

<div class="cliente-nome">
${cliente.nome}
</div>

<div class="cliente-cnpj">
${cliente.documento || "-"}
</div>

<div class="acessos-lista">
${acessosHTML}
</div>

</div>

`

})

}catch(e){

console.error("Erro ao carregar clientes:",e)

}

}

function abrirAnyDesk(id){
window.location.href="anydesk:"+id
}

function copiar(texto){
navigator.clipboard.writeText(texto)
alert("ID copiado")
}

function filtrarClientes(){

let busca = document.getElementById("buscar").value.toLowerCase()

let cards = document.querySelectorAll(".cliente-card")

cards.forEach(card=>{

let nome = card.querySelector(".cliente-nome").innerText.toLowerCase()

card.style.display = nome.includes(busca) ? "flex" : "none"

})

}