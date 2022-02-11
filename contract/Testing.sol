// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

contract Testing {

    uint internal personCount = 0;
    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    
    struct Person {
        address payable owner;
        string name;
        uint age;
    }

    mapping (uint => Person) internal people;

    function writePerson (
        string memory _name,
        uint _age
    ) public {
        people[personCount] = Person(
            payable(msg.sender),
            _name,
            _age
        );

        personCount++;
    }

    function readPerson (uint _index) public view returns (
        address payable,
        string memory,
        uint
    ) {
        return (
            people[_index].owner,
            people[_index].name,
            people[_index].age
        );
    }

    function getPersonLength() public view returns (uint) {
        return (personCount);
    }

}