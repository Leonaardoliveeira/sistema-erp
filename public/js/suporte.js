const token = localStorage.getItem("token")

let clientes = []

async function carregarClientes(){

const res = await fetch("/api/clientes",{
headers:{ Authorization:"Bearer "+token }
})

clientes = await res.json()

mostrar(clientes)

}

function mostrar(lista){

const container = document.getElementById("listaClientes")

container.innerHTML=""

lista.forEach(cliente=>{

let acessosHTML=""

if(cliente.acessosRemotos){

cliente.acessosRemotos.forEach(a=>{

acessosHTML += `
<div class="acesso">

<div>
<strong>${a.nome}</strong> - ${a.anydesk}
</div>

<div>

<button class="btnConectar" onclick="conectar('${a.anydesk}')">
Conectar
</button>

<button class="btnCopiar" onclick="copiar('${a.anydesk}')">
Copiar
</button>

</div>

</div>
`

})

}

container.innerHTML += `

<div class="cliente">

<h3>${cliente.nome}</h3>

${acessosHTML}

</div>

`

})

}

function conectar(id){

window.location.href="anydesk:"+id

}

function copiar(id){

navigator.clipboard.writeText(id)

alert("ID copiado")

}

document.getElementById("buscar").addEventListener("keyup",e=>{

const termo = e.target.value.toLowerCase()

const filtrados = clientes.filter(c =>
c.nome.toLowerCase().includes(termo)
)

mostrar(filtrados)

})

carregarClientes()