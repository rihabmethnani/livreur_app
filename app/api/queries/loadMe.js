// app/api/queries/loadMe.js
import { gql } from '@apollo/client';

export const LOAD_ME_QUERY = gql`
  query LoadMe($token: String!) {
    loadMe(token: $token) {
      _id
      name
      email
      role
    }
  }
`;

export default LOAD_ME_QUERY;