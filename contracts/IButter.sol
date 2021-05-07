pragma solidity 0.6.4;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IButter is IERC20 {
    function burnFrom(address account, uint256 amount) external;
}
