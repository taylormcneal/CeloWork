import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from "bignumber.js"
import celoworkAbi from "../contract/celowork.abi.json"
import erc20Abi from "../contract/erc20.abi.json"
import { ERC20_DECIMALS, MyContractAddress, cUSDContractAddress } from "./utils/constants.js"

let contract
let kit

//array to hold all of the job listings stored within the contract
let jobListings = []
//array to hold all of the non paid indexes of job listings owned by the currently connected celo wallet
let activeOwnedJobListings = []
//array to hold all of the indexes of job listings with non paid proposals by the currently connected celo wallet
let activeOwnedProposals = []

let cUSDBalance

//connect the celo wallet
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

//approve a given amount to be sent through the celo extension wallet
async function approve (_amount) {
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

    const result = await cUSDContract.methods
        .approve(MyContractAddress, _amount)
        .send({ from: kit.defaultAccount })
    return result
}

//load the cUSD balance of the currently connected wallet
const getBalance = async function () {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
}

//contact the contract to pull in all of the job listings stored within the contract
const getJobListings = async function () {
    jobListings = []
    activeOwnedJobListings = []
    activeOwnedProposals = []

    const _jobListingsLength = await contract.methods.getJobListingsLength().call()
    const _jobListings = []

    //fill the job listings array from the contract
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

    //pull in all of the proposals for all of the job listings
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
}

//top right of the navbar
//this shows an icon for the connected wallet and the current cUSD balance
function updateNavbar () {
    document.getElementById("navbar-right").style.display = "flex"
    document.getElementById("navbar-right").innerHTML = profileTemplate()
}

//use the blockies library to generate an icon for the currently connected wallet
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

//populate the web page with the data currently stored in this script
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

//display the job listings in the main section of the web page
//change the button's functionality depending on the status of the job listing
function displayJobListings () {
    for (let i = 0; i < jobListings.length; i++) {
        //display the job listings that are currently accepting proposals
        if (jobListings[i].jobListingStatus == 0) {
            const newDiv = document.createElement("div")
            newDiv.className = "rounded-3 p-4 shadow-sm my-5"
            newDiv.innerHTML = jobListingTemplate(i)

            const button = document.createElement("button")
            button.setAttribute("type", "button")

            //allow the user to view proposals if the user owns the job listing
            if (activeOwnedJobListings.includes(i)) {
                button.setAttribute("class", "btn btn-primary flex-shrink-0")
                button.setAttribute("data-bs-toggle", "modal")
                button.setAttribute("data-bs-target", "#viewProposalsModal")
                button.setAttribute("data-index", i)
                button.innerText = "View Proposals"

                button.addEventListener("click", () => {
                    updateViewProposalsModal(button.dataset.index)
                })
            
            //show the user if they've submitted a proposal for this job listing
            } else if (activeOwnedProposals.includes(i)) {
                button.setAttribute("class", "btn btn-secondary flex-shrink-0 disabled")
                button.innerText = "Proposal Submitted"

            //allow users to submit new proposals to job listings
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

//an html template for the display of job listings
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

//control the display of active owned job listings in the offscreen menu
//this is the display of non-paid job listings owned by the currently connected wallet
function displayActiveJobListings () {
    //display that there are no active job listings currently
    if (activeOwnedJobListings.length == 0) {
        const newP = document.createElement("p")
        newP.innerHTML = "No active job listings"
        document.getElementById("activeJobListings").append(newP)

    //populate the offscreen menu with non-paid job listings owned by the currently connected wallet
    } else {
        for (let i = 0; i < activeOwnedJobListings.length; i++) {
                const newDiv = document.createElement("div")
                newDiv.className = "mb-4"
                newDiv.innerHTML = activeJobListingTemplate(jobListings[activeOwnedJobListings[i]])
    
                const button = document.createElement("button")
                button.setAttribute("type", "button")
                button.className = "btn btn-primary"
    
                //allow the user to view currently available proposals for the given listing
                if (jobListings[activeOwnedJobListings[i]].jobListingStatus == 0) {
                    button.setAttribute("data-bs-toggle", "modal")
                    button.setAttribute("data-bs-target", "#viewProposalsModal")
                    button.setAttribute("data-index", activeOwnedJobListings[i])
                    button.innerText = "View Proposals"
    
                    button.addEventListener("click", () => {
                        updateViewProposalsModal(button.dataset.index)
                    })

                //if a proposal is currently active for the listing, allow the user to pay the bounty for completion of the job
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

//an html template for active job listings
function activeJobListingTemplate (_jobListing) {
    return `
        <div class="container-fluid">
            <h6 class="mb-3">${_jobListing.name}</h6>
        </div>
    `
}

//display the non-paid proposals owned by the currently connected wallet
function displayActiveProposals () {
    //display there are no owned active proposals
    if (activeOwnedProposals.length == 0) {
        const newP = document.createElement("p")
        newP.innerHTML = "No active proposals"
        document.getElementById("activeProposals").append(newP)
    //display the currently active owned proposals
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

//an html template for the active proposals displayed in the offscreen menu
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

//update the data displayed in the proposal view modal
function updateViewProposalsModal (_index) {
    document.getElementById("jobListingProposalView").innerHTML = ""
    displayViewProposalsModal(_index)
}

//controls the population of data within the proposal view modal
function displayViewProposalsModal (_index) {
    //display that there are no proposals currently submitted
    if (jobListings[_index].proposals.length == 0) {
        document.getElementById("jobListingProposalView").innerText = "No proposals submitted"
    }

    //iterate through a given job listing's proposals displaying their data
    for (let i = 0; i < jobListings[_index].proposals.length; i++) {
        const newDiv = document.createElement("div")
        newDiv.innerHTML = viewProposalModalTemplate(_index, i)

        //allow users to activate a proposal for a job listing
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

//an html template for display proposals in the proposal view modal
function viewProposalModalTemplate (_jobListingsIndex, _proposalIndex) {
    return `
        <h6>${ jobListings[_jobListingsIndex].proposals[_proposalIndex].email }</h6>
        <p>${ jobListings[_jobListingsIndex].proposals[_proposalIndex].proposalBody }</p>
    `
}

//handle the display of notifications to the user
function notification (_text) {
    document.getElementById("notification").style.display = "block"
    document.getElementById("notification").textContent = _text
}

//turn off the display of notifications
function notificationOff () {
    document.getElementById("notification").style.display = "none"
}

//reload all of the displayed dynamic content on the page
async function loadContent () {
    await connectCeloWallet()
    await getBalance()
    await getJobListings()
    updateContent()
}

//when the celo wallet detects a change in connected account, reload the dynamic content on the page
window.celo.on("accountsChanged", async () => {
    loadContent()
})

//when the window loads, load the dynamic content on the page
window.addEventListener("load", async () => {
    loadContent()
})

//an event handler to control adding new job listings to the contract
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

    //contact the contract to write a job listing entry and pay for its bounty upfront
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

//an event handler to control adding new proposals to the contract
document.querySelector("#newProposalButton").addEventListener("click", async () => {
    const jobListingIndex = document.getElementById("newProposalJobListingIndex").value

    const params = [
        jobListingIndex,
        document.getElementById("newProposalEmail").value,
        document.getElementById("newProposalDescription").value
    ]

    notification(`Submitting proposal for "${jobListings[jobListingIndex].name}"...`)

    //pass in the necessary parameters to write a proposal for a given job listing
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

//choose a proposal to activate as the active proposal for a given job listing
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

//once the job is completed, allow the user to release payment for the proposal owner
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