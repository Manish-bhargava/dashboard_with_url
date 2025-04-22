import React, { useState, useMemo, useEffect } from 'react';
import './CompetencyTable.css';

const topicIdToSubCompetencyMap = {
  // Situation Management
  14: ['Situational Awareness', 'Situation Management'],
  15: ['Swiftness/Timeliness of Response', 'Situation Management'],
  16: ['Emotional Balance', 'Situation Management'],
  17: ['Stress Handling Capacity', 'Situation Management'],

  // Relationship Building
  3: ['Effective Communication', 'Relationship Building'],
  4: ['Teamwork/Collaboration', 'Relationship Building'],
  7: ['People Handling', 'Relationship Building'],
  8: ['Openness to Change', 'Relationship Building'],
  9: ['Accepting Suggestions/Criticism', 'Relationship Building'],
  10: ['High Tolerance Levels', 'Relationship Building'],

  // Quality in Healthcare Delivery
  5: ['Work Ethic', 'Quality in Healthcare Delivery'],
  6: ['Empathy Towards Patients and Relatives', 'Quality in Healthcare Delivery'],
  11: ['Assertiveness', 'Quality in Healthcare Delivery'],
  12: ['Critical Thinking', 'Quality in Healthcare Delivery'],
  13: ['Willingness to Learn', 'Quality in Healthcare Delivery'],

  // Leadership
  18: ['Mentoring', 'Leadership'],
  19: ['Taking Initiative', 'Leadership'],
  20: ['Conflict Management', 'Leadership'],
  21: ['Ambition', 'Leadership'],
};

const UnitSubCompetencyTable = ({ data, selectedCompetency }) => {
  console.log('🔄 Component render started');
  
  // All hooks must be called at the top level, unconditionally
  const [searchTerm, setSearchTerm] = useState('');
  console.log('📝 searchTerm state:', searchTerm);
  
  const [sortConfig, setSortConfig] = useState({
    key: 'totalScore',
    direction: 'none'
  });
  console.log('🔀 sortConfig state:', sortConfig);

  const reportData = data?.data || data;
  console.log('📊 reportData:', reportData);
  
  // Move useMemo hooks to the top level
  const relevantTopics = useMemo(() => {
    console.log('🔍 Calculating relevantTopics');
    const topics = Object.entries(topicIdToSubCompetencyMap)
      .filter(([, [, comp]]) => comp === selectedCompetency)
      .map(([topicId, [name]]) => ({ topicId, name }));
    console.log('📋 relevantTopics result:', topics);
    return topics;
  }, [selectedCompetency]);

  const tableRows = useMemo(() => {
    console.log('📈 Calculating tableRows');
    if (!reportData || typeof reportData !== 'object') {
      console.log('❌ Invalid reportData for tableRows');
      return [];
    }
    
    const rows = [];
    let sno = 1;

    Object.entries(reportData).forEach(([unitName, users]) => {
      if (!users || typeof users !== 'object') return;

      Object.entries(users).forEach(([userId, userData]) => {
        const basic = userData.user_basic_detail || {};
        const sectionDetails = userData.section_detail || {};
        const topicMap = {};

        Object.values(sectionDetails).forEach(section => {
          const topics = section.topic_detail || {};
          Object.entries(topics).forEach(([topicId, topic]) => {
            if (topicIdToSubCompetencyMap[topicId]) {
              topicMap[topicId] = {
                score: topic.topic_total_score,
                unitPercentile: topic.unit_topic_percentile_score,
                mhPercentile: topic.topic_percentile_score
              };
            }
          });
        });

        const totalScore = relevantTopics.reduce((acc, { topicId }) => {
          const raw = topicMap[topicId]?.score;
          const num = parseFloat(raw);
          return acc + (isNaN(num) ? 0 : num);
        }, 0);

        rows.push({
          sno: sno++,
          studentName: basic.student_name || '-',
          unit: basic.unit_name || unitName,
          department: basic.department || '-',
          totalScore: totalScore ? totalScore.toFixed(2) : '-',
          topicMap
        });
      });
    });

    console.log('📊 tableRows result:', rows);
    return rows;
  }, [reportData, relevantTopics]);

  const filteredRows = useMemo(() => {
    console.log('🔍 Filtering rows with searchTerm:', searchTerm);
    if (!searchTerm) {
      console.log('📊 No search term, returning all rows');
      return tableRows;
    }
    const searchLower = searchTerm.toLowerCase();
    const filtered = tableRows.filter(row => 
      row.unit.toLowerCase().includes(searchLower) ||
      row.department.toLowerCase().includes(searchLower) ||
      row.studentName.toLowerCase().includes(searchLower)
    );
    console.log('📊 Filtered rows result:', filtered);
    return filtered;
  }, [tableRows, searchTerm]);

  const sortedAndFilteredRows = useMemo(() => {
    console.log('🔄 Sorting rows with config:', sortConfig);
    const sorted = [...filteredRows].sort((a, b) => {
      const aValue = a.totalScore === '-' ? -Infinity : parseFloat(a.totalScore);
      const bValue = b.totalScore === '-' ? -Infinity : parseFloat(b.totalScore);
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
    console.log('📊 Sorted rows result:', sorted);
    return sorted;
  }, [filteredRows, sortConfig.direction]);

  // Add effect to track component lifecycle
  useEffect(() => {
    console.log('🎯 Component mounted/updated');
    return () => {
      console.log('🧹 Component cleanup');
    };
  });

  // Early returns after all hooks
  if (!reportData || typeof reportData !== 'object') {
    console.log('❌ Invalid data structure');
    return <div className="no-data">No data available. Please check your selected filters and try again.</div>;
  }

  if (relevantTopics.length === 0) {
    console.log('❌ No relevant topics found');
    return <div className="no-data">No competency topics selected. Please select a competency to view the data.</div>;
  }

  if (filteredRows.length === 0) {
    console.log('❌ No filtered rows found');
    return (
      <div className="table-container">
        <div className="search-container">
          <input
            type="text"
            className="name-search-input"
            placeholder="Search by name, department, or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="no-data">No records found for student "{searchTerm}"</div>
      </div>
    );
  }

  console.log('🎨 Rendering table with rows:', sortedAndFilteredRows.length);

  const renderPercentileBar = (value) => {
    if (!value || value === '-') return '-';
    const percentage = parseFloat(value);
    if (isNaN(percentage)) return '-';
    
    return (
      <div className="percentile-cell-container">
        <div className="mini-percentile-bar">
          <div 
            className="mini-percentile-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="percentile-value">{percentage.toFixed(2)}</span>
      </div>
    );
  };

  const safeValue = (val) =>
    val === null || val === undefined || val === '' ? '-' : val;

  const calculateTotalScore = (topicId) => {
    // Get the first unit's data
    const firstUnit = Object.values(reportData)[0];
    if (!firstUnit) return 0;

    // Get the first user's data that has section_detail
    const firstUser = Object.values(firstUnit).find(user => user.section_detail);
    if (!firstUser || !firstUser.section_detail) return 0;

    // Get the section that contains the topic
    const section = Object.values(firstUser.section_detail).find(section => 
      section.topic_detail && section.topic_detail[topicId]
    );
    if (!section) return 0;

    // Get the topic data
    const topic = section.topic_detail[topicId];
    if (!topic) return 0;

    const correctMarks = parseFloat(section.correct_marks || 0);
    const totalQuestions = parseFloat(topic.topic_total_question || 0);

    // Calculate maximum possible score
    const maxScore = totalQuestions * correctMarks;
    return maxScore.toFixed(1);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    if (sortConfig.direction === 'asc') return '↑';
    if (sortConfig.direction === 'desc') return '↓';
    return '↕️';
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'none') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'none' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          className="name-search-input"
          placeholder="Search by name, department, or unit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="table-wrapper">
        <table className="competency-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Student Name</th>
              <th>Unit</th>
              <th>Department</th>
              <th 
                onClick={() => handleSort('totalScore')}
                style={{ cursor: 'pointer' }}
              >
                Total Score ({calculateTotalScore(relevantTopics[0]?.topicId)}) 
                <span style={{ marginLeft: '5px' }}>
                  {getSortIcon('totalScore')}
                </span>
              </th>
              {relevantTopics.map(({ topicId, name }) => (
                <React.Fragment key={name}>
                  <th>{name} Score ({calculateTotalScore(topicId)})</th>
                  <th>{name} Unit Percentile</th>
                  <th>{name} MH Percentile</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredRows.map((row) => (
              <tr key={row.sno}>
                <td>{row.sno}</td>
                <td>{safeValue(row.studentName)}</td>
                <td>{safeValue(row.unit)}</td>
                <td>{safeValue(row.department)}</td>
                <td>{safeValue(row.totalScore)}</td>
                {relevantTopics.map(({ topicId, name }) => (
                  <React.Fragment key={name}>
                    <td>{safeValue(row.topicMap[topicId]?.score)}</td>
                    <td>{renderPercentileBar(row.topicMap[topicId]?.unitPercentile)}</td>
                    <td>{renderPercentileBar(row.topicMap[topicId]?.mhPercentile)}</td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UnitSubCompetencyTable;
