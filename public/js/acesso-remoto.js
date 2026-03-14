const token = localStorage.getItem("token")

async function carregar() {

const res = await fetch("/api/acessos",{
headers:{ Authorization:"Bearer "+token }
})

const dados = await res.json()

const lista = document.getElementById("lista")
lista.innerHTML=""

dados.forEach(a=>{

lista.innerHTML += `
<tr>
<td>${a.clienteId?.nome || ""}</td>
<td>${a.maquina || ""}</td>
<td>${a.anydesk}</td>

<td>

<button onclick="conectar('${a.anydesk}')">
Conectar
</button>

<button onclick="copiar('${a.anydesk}')">
Copiar
</button>

<button onclick="remover('${a._id}')">
Excluir
</button>

</td>

</tr>
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

async function remover(id){

if(!confirm("Excluir acesso?")) return

await fetch("/api/acessos/"+id,{
method:"DELETE",
headers:{ Authorization:"Bearer "+token }
})

carregar()

}

carregar()