// import React, { useState, useEffect } from 'react';

// const UserWiseSubCompetency = () => {
//   const [selectedUnits, setSelectedUnits] = useState([]);
//   const [selectedTests, setSelectedTests] = useState([]);
//   const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
//   const [showTestsDropdown, setShowTestsDropdown] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [reportData, setReportData] = useState([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [hasStudentNames, setHasStudentNames] = useState(false);

//   // Check if data contains student names
//   useEffect(() => {
//     if (reportData.length > 0) {
//       const hasNames = reportData.some(item => item.studentName || item.name);
//       setHasStudentNames(hasNames);
//     }
//   }, [reportData]);

//   // Filter data based on search term
//   const filteredData = reportData.filter(item => {
//     if (!searchTerm) return true;
//     const searchLower = searchTerm.toLowerCase();
//     return (
//       item.name?.toLowerCase().includes(searchLower) ||
//       item.studentName?.toLowerCase().includes(searchLower) ||
//       item.unit?.toLowerCase().includes(searchLower)
//     );
//   });

//   return (
//     <div className="table-container">
//       <div className="search-container">
//         <input
//           type="text"
//           className="name-search-input"
//           placeholder="Search by name or unit..."
//           value={searchTerm}
//           onChange={(e) => setSearchTerm(e.target.value)}
//         />
//       </div>
//       {filteredData.length === 0 ? (
//         <div className="no-data">No records found</div>
//       ) : (
//         <table className="competency-table">
//           <tbody>
//             {filteredData.map((item) => (
//               <tr key={item.id || item.name}>
//                 <td>{item.name || item.studentName}</td>
//                 <td>{item.unit}</td>
//                 <td>{item.department}</td>
//                 <td>{item.score}</td>
//                 <td className="mh-percentile">
//                   {item.percentile ? renderPercentileBar(item.percentile) : '-'}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );
// };

// export default UserWiseSubCompetency; 