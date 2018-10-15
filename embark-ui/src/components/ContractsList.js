import PropTypes from "prop-types";
import React from 'react';
import {Table} from "reactstrap";
import {Link} from 'react-router-dom';
import {formatContractForDisplay} from '../utils/presentation';

const ContractsList = ({contracts}) => (
  <Table responsive className="text-nowrap">
    <thead>
      <tr>
        <th>Name</th>
        <th>Address</th>
        <th>State</th>
      </tr>
    </thead>
    <tbody>
      {
        contracts.map((contract) => {
          const contractDisplay = formatContractForDisplay(contract);
          return (
            <tr key={contract.className} className={contractDisplay.stateColor}>
              <td><Link to={`/embark/contracts/${contract.className}/overview`}>{contract.className}</Link></td>
              <td>{contractDisplay.address}</td>
              <td>{contractDisplay.state}</td>
            </tr>
          );
        })
      }
    </tbody>
  </Table>
)

ContractsList.propTypes = {
  contracts: PropTypes.array,
};

export default ContractsList;
