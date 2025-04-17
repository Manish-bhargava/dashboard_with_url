// import React, { useMemo } from 'react';

// const UserWiseMainCompetency = () => {
//   const tableRows = useMemo(() => {
//     const rows = [];
//     let sno = 1;

//     Object.entries(reportData).forEach(([userId, userData]) => {
//       const basic = userData.user_basic_detail || {};
//       const sectionDetails = userData.section_detail || {};
//       const competencyMap = {};

//       Object.values(sectionDetails).forEach(section => {
//         const topics = section.topic_detail || {};
//         Object.entries(topics).forEach(([topicId, topic]) => {
//           if (topicIdToCompetencyMap[topicId]) {
//             const competencyId = topicIdToCompetencyMap[topicId];
//             if (!competencyMap[competencyId]) {
//               competencyMap[competencyId] = {
//                 scores: [],
//                 unitPercentiles: [],
//                 mhPercentiles: []
//               };
//             }
//             competencyMap[competencyId].scores.push(topic.topic_total_score);
//             competencyMap[competencyId].unitPercentiles.push(topic.unit_topic_percentile_score);
//             competencyMap[competencyId].mhPercentiles.push(topic.topic_percentile_score);

//             // Debug log for effective communication
//             if (competencyId === 'effective_communication') {
//               console.log('Effective Communication Topic:', {
//                 topicId,
//                 score: topic.topic_total_score,
//                 unitPercentile: topic.unit_topic_percentile_score,
//                 mhPercentile: topic.topic_percentile_score
//               });
//             }
//           }
//         });
//       });

//       // Debug log for effective communication scores
//       if (competencyMap['effective_communication']) {
//         console.log('Effective Communication Scores:', {
//           studentName: basic.student_name,
//           scores: competencyMap['effective_communication'].scores,
//           mhPercentiles: competencyMap['effective_communication'].mhPercentiles
//         });
//       }

//       rows.push({
//         sno: sno++,
//         studentName: basic.student_name || '-',
//         unit: basic.unit_name || '-',
//         department: basic.department || '-',
//         competencyMap
//       });
//     });

//     return rows;
//   }, [reportData]);

//   return (
//     // Render your table component here
//   );
// };

// export default UserWiseMainCompetency; 