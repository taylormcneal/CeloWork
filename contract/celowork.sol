// SPDX-License-Identifier: MIT

interface IERC20Token {
	function transfer(address, uint256) external returns (bool);
	function approve(address, uint256) external returns (bool);
	function transferFrom(address, address, uint256) external returns (bool);
	function totalSupply() external view returns (uint256);
	function balanceOf(address) external view returns (uint256);
	function allowance(address, address) external view returns (uint256);

	event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

pragma solidity >=0.7.0 <0.9.0;

contract CeloWork {

    address payable contractOwner;
    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    //proposal struct
    //proposals represent a prospective worker for a given job listing
    struct Proposal {
        address payable owner;
        string email;
        string proposalBody;
    }

    //job listing status enum
    enum JobListingStatus {
        AcceptingProposals,
        ActiveProposal,
        PaidProposal
    }

    //job listing struct
        //job listings represent a listing for an available job with a given pay
    //need to add email field
    struct JobListing {
        address payable owner;
        JobListingStatus status;
        string email;
        string name;
        string description;
        uint bounty;
        uint proposalsLength;
        uint activeProposal;
        mapping (uint => Proposal) proposals;
    }

    //job listing mapping and length variable
    mapping (uint => JobListing) internal jobListings;
    uint internal jobListingsLength = 0;

    //function modifier to check that the call came from the job listing's owner
    modifier onlyJobListingOwner (uint _index) {
        require (msg.sender == jobListings[_index].owner);
        _;
    }

    //write job listing
        //add a job listing to the job listing mapping
        //the owner of the job listing pays the bounty upfront
    function writeJobListing (
        string memory _email,
        string memory _name,
        string memory _description,
        uint _bounty
    ) public payable {
        //require the owner of the job listing to pay the bounty of the job listing to the contract
        require(
            IERC20Token(cUsdTokenAddress).transferFrom(
                payable(msg.sender),
                address(this),
                _bounty
            ),
            "Transfer failed."
        );

        //append the job listing to the job listing mapping

        JobListing storage _jobListing = jobListings[jobListingsLength++];
        _jobListing.owner = payable(msg.sender);
        _jobListing.status = JobListingStatus.AcceptingProposals;
        _jobListing.email = _email;
        _jobListing.name = _name;
        _jobListing.description = _description;
        _jobListing.bounty = _bounty;
        _jobListing.proposalsLength = 0;
    }

    //read job listing
        //given an index, return the fields of the corresponding job listing
    function readJobListing (uint _index) public view returns (
        address payable,
        JobListingStatus,
        string memory,
        string memory,
        string memory,
        uint,
        uint
    ) {
        return (
            jobListings[_index].owner,
            jobListings[_index].status,
            jobListings[_index].email,
            jobListings[_index].name,
            jobListings[_index].description,
            jobListings[_index].bounty,
            jobListings[_index].activeProposal
        );
    }

    //write proposal
        //given a job listing index, add a proposal to the corresponding job listing's proposal mapping
    function writeProposal (
        uint _jobListingIndex,
        string memory _email,
        string memory _proposalBody
    ) external {
        jobListings[_jobListingIndex].proposals[jobListings[_jobListingIndex].proposalsLength] = Proposal(
            payable(msg.sender),
            _email,
            _proposalBody
        );

        jobListings[_jobListingIndex].proposalsLength++;
    }

    //read proposal
        //given a job listing index and a proposal index, return the fields of the corresponding proposal
    function readProposal (uint _jobListingIndex, uint _proposalIndex) external view returns (
        address payable,
        string memory,
        string memory
    ) {
        return (
            jobListings[_jobListingIndex].proposals[_proposalIndex].owner,
            jobListings[_jobListingIndex].proposals[_proposalIndex].email,
            jobListings[_jobListingIndex].proposals[_proposalIndex].proposalBody
        );
    }

    //select proposal
        //given a job listing index and a proposal index, mark the proposal as active
    function selectProposal (uint _jobListingIndex, uint _proposalIndex) external onlyJobListingOwner (_jobListingIndex) {
        jobListings[_jobListingIndex].activeProposal = _proposalIndex;
        jobListings[_jobListingIndex].status = JobListingStatus.ActiveProposal;
    }

    //pay proposal
        //given a job listing index, pay the corresponding active proposal the bounty of the job listing
    function payProposal (uint _jobListingIndex) external onlyJobListingOwner (_jobListingIndex) {
        require(
            IERC20Token(cUsdTokenAddress).transfer(
                payable(jobListings[_jobListingIndex].proposals[jobListings[_jobListingIndex].activeProposal].owner),
                jobListings[_jobListingIndex].bounty
            ),
            "Transfer failed."
        );
        jobListings[_jobListingIndex].status = JobListingStatus.PaidProposal;
    }

    //get job listing mapping length
        //return the length of the job listing mapping
    function getJobListingsLength () public view returns (uint) {
        return (jobListingsLength);
    }

    //get proposal mapping length
        //given a job listing index, return the length of the corresponding proposal mapping
    function getProposalsLength (uint _jobListingIndex) public view returns (uint) {
        return (jobListings[_jobListingIndex].proposalsLength);
    }

}