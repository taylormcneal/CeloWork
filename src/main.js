import Web3 from 'web3'
import { newKit, newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from "bignumber.js"
import celoworkAbi from "../contract/celowork.abi.json"
import erc20Abi from "../contract/erc20.abi.json"

const ERC20_DECIMALS = 18
const MyContractAddress = "0xe6d475e42393d3849EAeFcfD6C56178A1Be3aF00"
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"

let contract
let kit

let jobListings = []
let activeOwnedJobListings = []
let activeOwnedProposals = []

let cUSDBalance

const connectCeloWallet = async function () {
    if (window.celo) {
        notification("Please approve this DApp to use it.")
        try {
            await window.celo.enable()
            notificationOff()

            const web3 = new Web3(window.celo)
            kit = newKitFromWeb3(web3)

            const accounts = await kit.web3.eth.getAccounts()
            kit.defaultAccount = accounts[0]

            contract = new kit.web3.eth.Contract(celoworkAbi, MyContractAddress)
        } catch (error) {
            notification(error)
        }
    } else {
        notification("Please install the CeloExtensionWallet.")
    }
}

const getBalance = async function () {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
}

const getJobListings = async function () {
    jobListings = []
    activeOwnedJobListings = []
    activeOwnedProposals = []

    const _jobListingsLength = await contract.methods.getJobListingsLength().call()
    const _jobListings = []

    for (let i = 0; i < _jobListingsLength; i++) {
        let _jobListing = new Promise(async (resolve, reject) => {
            let jl = await contract.methods.readJobListing(i).call()

            if (jl[0] == kit.defaultAccount && jl[1] != 2)
                activeOwnedJobListings.push(i)

            resolve({
                index: i,
                owner: jl[0],
                jobListingStatus: jl[1],
                email: jl[2],
                name: jl[3],
                description: jl[4],
                bounty: jl[5],
                activeProposal: jl[6],
                proposals: []
            })
        })
        _jobListings.push(_jobListing)
    }
    jobListings = await Promise.all(_jobListings)

    for (let i = 0; i < jobListings.length; i++) {
        let _proposals = []
        const _proposalsLength = await contract.methods.getProposalsLength(i).call()
        for (let j = 0; j < _proposalsLength; j++) {
            let _proposal = new Promise(async (resolve, reject) => {
                let p = await contract.methods.readProposal(i, j).call()

                if (p[0] == kit.defaultAccount && jobListings[i].jobListingStatus != 2)
                    activeOwnedProposals.push(i)

                resolve({
                    owner: p[0],
                    email: p[1],
                    proposalBody: p[2]
                })
            })
            _proposals.push(_proposal)
        }
        jobListings[i].proposals = await Promise.all(_proposals)
    }

    console.log(jobListings)
    console.log(activeOwnedJobListings)
    console.log(activeOwnedProposals)
}

function updateNavbar () {
    document.getElementById("navbar-right").style.display = "flex"
    document.getElementById("navbar-right").innerHTML = profileTemplate()
}

function profileTemplate () {
    const icon = blockies
        .create({
            seed: kit.defaultAccount,
            size: 8,
            scale: 16,
        })
        .toDataURL()

    return `
        <span class="p-2 mx-2 rounded-pill border border-1 border-dark">${cUSDBalance} cUSD</span>
        <img style="margin: 0 12px 0 5px; height: 40px; width: 40px;" src="${icon}" alt="${kit.defaultAccount}">
        <span class="navbar-toggler-icon" style="background-size: 130%;"></span>
    `
}

function updateContent () {
    //clear the current divs holding information from the contract
    document.getElementById("jobListingsContainer").innerHTML = ""
    document.getElementById("activeJobListings").innerHTML = ""
    document.getElementById("activeProposals").innerHTML = ""

    updateNavbar()
    displayJobListings()
    displayActiveJobListings()
    displayActiveProposals()
}

function displayJobListings () {
    for (let i = 0; i < jobListings.length; i++) {
        if (jobListings[i].jobListingStatus == 0) {
            const newDiv = document.createElement("div")
            newDiv.className = "rounded-3 p-4 shadow-sm my-5"
            newDiv.innerHTML = jobListingTemplate(i)

            const button = document.createElement("button")
            button.setAttribute("type", "button")

            if (activeOwnedJobListings.includes(i)) {
                button.setAttribute("class", "btn btn-primary flex-shrink-0")
                button.setAttribute("data-bs-toggle", "modal")
                button.setAttribute("data-bs-target", "#viewProposalsModal")
                button.setAttribute("data-index", i)
                button.innerText = "View Proposals"

                button.addEventListener("click", () => {
                    updateViewProposalsModal(button.dataset.index)
                })
            } else if (activeOwnedProposals.includes(i)) {
                button.setAttribute("class", "btn btn-secondary flex-shrink-0 disabled")
                button.innerText = "Proposal Submitted"
            } else {
                button.setAttribute("class", "btn btn-primary flex-shrink-0")
                button.setAttribute("data-bs-toggle", "modal")
                button.setAttribute("data-bs-target", "#createProposalModal")
                button.setAttribute("data-index", i)
                button.innerText = "Submit Proposal"

                button.addEventListener("click", () => {
                    document.getElementById("newProposalJobListingIndex").value = button.dataset.index;
                })
            }

            let innerDiv = newDiv.querySelector("#proposalInfo")
            innerDiv.append(button)

            document.getElementById("jobListingsContainer").appendChild(newDiv)
        }
    }
}

function jobListingTemplate (_index) {
    return `
        <div class="d-flex flex-column flex-md-row">
            <h3 class="flex-md-grow-1 me-md-1 mb-4 mb-md-0">${jobListings[_index].name}</h3>
            <div class="flex-md-shrink-0 px-2 py-1 align-self-start border border-1 border-dark rounded-3">
                ${new BigNumber(jobListings[_index].bounty).shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD
            </div>
        </div>

        <p class="my-4">${jobListings[_index].description}</p>

        <hr class="mb-4" />

        <div id="proposalInfo" class="d-flex">
                <div class="flex-grow-1 d-flex align-items-center">${jobListings[_index].proposals.length} ${jobListings[_index].proposals.length == 1 ? 'Proposal' : 'Proposals'}</div>
    `
}

function displayActiveJobListings () {
    if (activeOwnedJobListings.length == 0) {
        const newP = document.createElement("p")
        newP.innerHTML = "No active job listings"
        document.getElementById("activeJobListings").append(newP)
    } else {
        for (let i = 0; i < activeOwnedJobListings.length; i++) {
                const newDiv = document.createElement("div")
                newDiv.className = "mb-4"
                newDiv.innerHTML = activeJobListingTemplate(jobListings[activeOwnedJobListings[i]])
    
                const button = document.createElement("button")
                button.setAttribute("type", "button")
                button.className = "btn btn-primary"
    
                if (jobListings[activeOwnedJobListings[i]].jobListingStatus == 0) {
                    button.setAttribute("data-bs-toggle", "modal")
                    button.setAttribute("data-bs-target", "#viewProposalsModal")
                    button.setAttribute("data-index", activeOwnedJobListings[i])
                    button.innerText = "View Proposals"
    
                    button.addEventListener("click", () => {
                        updateViewProposalsModal(button.dataset.index)
                    })
                } else {
                    button.setAttribute("data-index", activeOwnedJobListings[i])
                    button.innerText = "Pay Bounty"
    
                    button.addEventListener("click", () => {
                        payProposal(button.dataset.index)
                    })
                }
    
                let innerDiv = newDiv.querySelector(".container-fluid")
                innerDiv.append(button)
    
                document.getElementById("activeJobListings").appendChild(newDiv)
    
                if (i < activeOwnedJobListings.length - 1)
                    document.getElementById("activeJobListings").appendChild(document.createElement("hr"))
        }
    }
}

function activeJobListingTemplate (_jobListing) {
    return `
        <div class="container-fluid">
            <h6 class="mb-3">${_jobListing.name}</h6>
        </div>
    `
}

function displayActiveProposals () {
    if (activeOwnedProposals.length == 0) {
        const newP = document.createElement("p")
        newP.innerHTML = "No active proposals"
        document.getElementById("activeProposals").append(newP)
    } else {
        for (let i = 0; i < activeOwnedProposals.length; i++) {
            const newDiv = document.createElement("div")
            newDiv.className = "mb-4"
            newDiv.innerHTML = activeProposalTemplate(jobListings[activeOwnedProposals[i]].index)
            document.getElementById("activeProposals").appendChild(newDiv)

            if (i < activeOwnedProposals.length - 1)
                document.getElementById("activeProposals").appendChild(document.createElement("hr"))
        }
    }
}

function activeProposalTemplate (_index) {
    if (jobListings[_index].jobListingStatus == 0) {
        return `
            <div class="container-fluid">
                <h6 class="mb-3">${jobListings[_index].name}</h6>
                <button type="button" class="btn btn-warning disabled">Pending</button>
            </div>
        `
    } else {
        return `
        <div class="container-fluid">
            <h6 class="mb-3">${jobListings[_index].name}</h6>
            <p class="mb-3">${jobListings[_index].email}</p>
            <button type="button" class="btn btn-success disabled">Active</button>
        </div>
        `
    }
}

function updateViewProposalsModal (_index) {
    document.getElementById("jobListingProposalView").innerHTML = ""
    displayViewProposalsModal(_index)
}

function displayViewProposalsModal (_index) {
    if (jobListings[_index].proposals.length == 0) {
        document.getElementById("jobListingProposalView").innerText = "No proposals submitted"
    }

    for (let i = 0; i < jobListings[_index].proposals.length; i++) {
        const newDiv = document.createElement("div")
        newDiv.innerHTML = viewProposalModalTemplate(_index, i)

        const button = document.createElement("button")
        button.setAttribute("type", "button")
        button.setAttribute("class", "btn btn-primary")
        button.setAttribute("data-jlindex", _index)
        button.setAttribute("data-pindex", i)
        button.setAttribute("data-bs-dismiss", "modal")
        button.innerText = "Activate Proposal"
        button.addEventListener("click", () => {
            activateProposal(button.dataset.jlindex, button.dataset.pindex)
        })

        newDiv.append(button)
        document.getElementById("jobListingProposalView").appendChild(newDiv)

        if (i < jobListings[_index].proposals.length - 1)
            document.getElementById("jobListingProposalView").appendChild(document.createElement("hr"))
    }
}

function viewProposalModalTemplate (_jobListingsIndex, _proposalIndex) {
    return `
        <h6>${ jobListings[_jobListingsIndex].proposals[_proposalIndex].email }</h6>
        <p>${ jobListings[_jobListingsIndex].proposals[_proposalIndex].proposalBody }</p>
    `
}

function notification (_text) {
    document.getElementById("notification").style.display = "block"
    document.getElementById("notification").textContent = _text
}

function notificationOff () {
    document.getElementById("notification").style.display = "none"
}

async function approve (_amount) {
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

    const result = await cUSDContract.methods
        .approve(MyContractAddress, _amount)
        .send({ from: kit.defaultAccount })
    return result
}

async function loadContent () {
    await connectCeloWallet()
    await getBalance()
    await getJobListings()
    updateContent()
}

window.celo.on("accountsChanged", async () => {
    loadContent()
})

window.addEventListener("load", async () => {
    loadContent()
})

document.querySelector("#newJobListingButton").addEventListener("click", async () => {

    const amount = new BigNumber(document.getElementById("newListingBounty").value)
        .shiftedBy(ERC20_DECIMALS)
        .toString();

    const params = [
        document.getElementById("newListingEmail").value,
        document.getElementById("newListingName").value,
        document.getElementById("newListingDescription").value,
        amount
    ]

    notification("Waiting for payment approval...")

    try {
        await approve(amount)
    } catch (err) {
        notification(`${err}`)
    }

    notification(`Awaiting payment for bounty...`)

    try {
        await contract.methods.writeJobListing(...params).send({ from: kit.defaultAccount })
        notification(`You successfully added "${ document.getElementById("newListingName").value }".`)

        document.getElementById("newListingEmail").value = ""
        document.getElementById("newListingName").value = ""
        document.getElementById("newListingDescription").value = ""
        document.getElementById("newListingBounty").value = ""

        await getJobListings()
        await getBalance()
        updateContent()
    } catch (err) {
        notification(`${err}`)
    }
})

document.querySelector("#newProposalButton").addEventListener("click", async () => {
    const jobListingIndex = document.getElementById("newProposalJobListingIndex").value

    const params = [
        jobListingIndex,
        document.getElementById("newProposalEmail").value,
        document.getElementById("newProposalDescription").value
    ]

    notification(`Submitting proposal for "${jobListings[jobListingIndex].name}"...`)

    try {
        const result = await contract.methods.writeProposal(...params).send({ from: kit.defaultAccount })

        notification(`You successfully submitted a proposal for "${jobListings[jobListingIndex].name}"`)

        document.getElementById("newProposalEmail").value = ""
        document.getElementById("newProposalDescription").value = ""

        await getJobListings()
        updateContent()
    } catch (err) {
        notification(`${err.prototype.stack}`)
    }
})

async function activateProposal (_jobListingIndex, _proposalIndex) {
    const params = [
        _jobListingIndex,
        _proposalIndex
    ]

    notification("Activating proposal...")

    try {
        const result = await contract.methods.selectProposal(...params).send({ from: kit.defaultAccount })
        notification(`Successfully activated proposal.`)
        await getJobListings()
        updateContent()
    } catch (err) {
        notification(`${err}`)
    }
}

async function payProposal (_index) {
    notification("Paying bounty...")

    try {
        const result = await contract.methods.payProposal(_index).send({ from: kit.defaultAccount })
        notification(`Successfully paid bounty.`)
        await getJobListings()
        await getBalance()
        updateContent()
    } catch (err) {
        notification(`${err}`)
    }
}