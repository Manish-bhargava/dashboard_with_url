import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './CompetencyTable.css';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Generate abbreviation from competency name
const getAbbreviation = (topicName) => {
  const words = topicName.split(/[ \/]+/);
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

const UserSubCompetencyTable = ({ data, selectedCompetency, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'none'
  });
  const [topicMappings, setTopicMappings] = useState({});
  const [topicAbbreviations, setTopicAbbreviations] = useState({});
  const [error, setError] = useState(null);
  
  // Fetch topic mappings from API
  useEffect(() => {
    const fetchTopicMappings = async () => {
      try {
        console.log('Fetching topic mappings from API...');
        const response = await axios.post(`${BASE_URL}/reportanalytics/getSubCompetency`, {});
        
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          const mappings = {};
          const abbreviations = {};
          
          response.data.data.forEach(section => {
            if (section.topics && Array.isArray(section.topics)) {
              section.topics.forEach(topic => {
                if (topic.topic_id && topic.topic_name) {
                  mappings[topic.topic_id] = [topic.topic_name, section.section_name];
                  abbreviations[topic.topic_id] = getAbbreviation(topic.topic_name);
                }
              });
            }
          });
          
          console.log('Generated topic mappings:', mappings);
          console.log('Generated abbreviations:', abbreviations);
          
          setTopicMappings(mappings);
          setTopicAbbreviations(abbreviations);
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        console.error('Error fetching topic mappings:', error);
        setError('Failed to load topic mappings');
      }
    };

    fetchTopicMappings();
  }, []);

  const reportData = data?.data || data;

  console.log('Initial Data:', data);
  console.log('Current Sort Config:', sortConfig);

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!reportData || typeof reportData !== 'object') {
    return <div className="no-data">No data available for selected filters.</div>;
  }

  const relevantTopics = Object.entries(topicMappings)
    .filter(([, [, comp]]) => comp === selectedCompetency)
    .map(([topicId, [name]]) => ({ topicId, name }));

  console.log('Selected Competency:', selectedCompetency);
  console.log('Relevant Topics:', relevantTopics);

  const unitMap = {};
  let sno = 1;

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

  Object.entries(reportData).forEach(([unitName, sections]) => {
    console.log('Processing Unit:', unitName);
    const topicStats = {};

    Object.values(sections).forEach((section) => {
      console.log('Processing Section:', section);
      const topics = section.topic_detail || {};
      Object.entries(topics).forEach(([topicId, topic]) => {
        // Debug log for all topics
        console.log('Topic Data:', {
          topicId,
          topicName: topicMappings[topicId]?.[0],
          competency: topicMappings[topicId]?.[1],
          selectedCompetency,
          topicData: topic
        });

        if (topicMappings[topicId] && topicMappings[topicId][1] === selectedCompetency) {
          if (!topicStats[topicId]) {
            topicStats[topicId] = {
              scoreSum: 0,
              mhPercentileSum: 0,
              count: 0,
            };
          }

          // Debug log for communication
          if (topicMappings[topicId][0] === 'Communication') {
            console.log('Communication Topic Data:', {
              topicId,
              topic,
              rawScore: topic.unit_topic_score_average,
              rawMhPercentile: topic.unit_topic_score_percentile,
              parsedScore: parseFloat(topic.unit_topic_score_average),
              parsedMhPercentile: parseFloat(topic.unit_topic_score_percentile)
            });
          }

          const score = parseFloat(topic.unit_topic_score_average || 0);
          const mhPercentile = parseFloat(topic.unit_topic_score_percentile || 0);

          topicStats[topicId].scoreSum += isNaN(score) ? 0 : score;
          topicStats[topicId].mhPercentileSum += isNaN(mhPercentile) ? 0 : mhPercentile;
          topicStats[topicId].count += 1;
        }
      });
    });

    // Debug log for topic stats
    console.log('Topic Stats for Unit:', {
      unitName,
      topicStats
    });

    const subCompetencyData = relevantTopics.map(({ topicId, name }) => {
      const stats = topicStats[topicId];
      if (!stats || stats.count === 0) {
        console.log('No stats found for:', { topicId, name });
        return { name, unitAvgScore: '-', mhPercentile: '-' };
      }
      const unitAvgScore = (stats.scoreSum / stats.count).toFixed(2);
      const mhPercentile = (stats.mhPercentileSum / stats.count).toFixed(2);
      
      // Debug log for final calculations
      console.log('Final Calculations:', {
        topicId,
        name,
        stats,
        unitAvgScore,
        mhPercentile
      });
      
      return { name, unitAvgScore, mhPercentile };
    });

    unitMap[unitName] = {
      sno: sno++,
      unitName,
      subCompetencyStats: subCompetencyData,
    };
  });

  const safe = (val) => (val === null || val === undefined || val === '' ? '-' : val);

  const getSortableValue = (row, key) => {
    if (key === 'sno') return row.sno;
    if (key === 'unitName') return row.unitName;
    
    // Handle total score sorting
    if (key === 'totalScore') {
      const totalScore = row.subCompetencyStats.reduce((total, stat) => {
        const score = parseFloat(safe(stat.unitAvgScore)) || 0;
        return total + score;
      }, 0);
      return isNaN(totalScore) ? -Infinity : totalScore;
    }
    
    // Handle individual score and percentile sorting
    if (key.endsWith('_score')) {
      const topicName = key.replace('_score', '');
      const statEntry = row.subCompetencyStats.find(stat => stat.name === topicName);
      if (statEntry) {
        const score = parseFloat(statEntry.unitAvgScore);
        return isNaN(score) ? -Infinity : score;
      }
      return -Infinity;
    }
    
    if (key.endsWith('_percentile')) {
      const topicName = key.replace('_percentile', '');
      const statEntry = row.subCompetencyStats.find(stat => stat.name === topicName);
      if (statEntry) {
        const percentile = parseFloat(statEntry.mhPercentile);
        return isNaN(percentile) ? -Infinity : percentile;
      }
      return -Infinity;
    }
    
    return row[key] || '';
  };

  const handleSort = (key) => {
    console.log('Sort clicked for key:', key);
    setSortConfig(prev => {
      const newConfig = {
        key: prev.key === key && prev.direction === 'desc' ? null : key,
        direction: prev.key === key ? 
          (prev.direction === 'none' ? 'asc' : 
           prev.direction === 'asc' ? 'desc' : 'none') : 
          'asc'
      };
      console.log('New sort config:', newConfig);
      return newConfig;
    });
  };

  const getSortIcon = (key) => {
    const icon = sortConfig.key !== key ? '↕️' :
                sortConfig.direction === 'asc' ? '↑' :
                sortConfig.direction === 'desc' ? '↓' : '↕️';
    console.log('Sort icon for', key, ':', icon);
    return icon;
  };

  // Process and sort data
  const processedData = [...Object.values(unitMap)].map((item, index) => ({
    ...item,
    sno: index + 1
  }));

  console.log('Processed Data:', processedData);

  const filteredData = useMemo(() => {
    console.log('Filtering data with search term:', searchTerm);
    if (!searchTerm) return processedData;

    const searchLower = searchTerm.toLowerCase();
    return processedData.filter(row => {
      // Search in unit name
      if (row.unitName?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in competency scores and percentiles
      return row.subCompetencyStats.some(stat => {
        const statName = stat.name?.toLowerCase() || '';
        const statScore = String(stat.unitAvgScore || '').toLowerCase();
        const statPercentile = String(stat.mhPercentile || '').toLowerCase();
        
        return statName.includes(searchLower) || 
               statScore.includes(searchLower) || 
               statPercentile.includes(searchLower);
      });
    });
  }, [processedData, searchTerm]);

  console.log('Filtered Data:', filteredData);

  const sortedData = useMemo(() => {
    if (sortConfig.direction === 'none') {
      console.log('No sorting direction, returning filtered data');
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = getSortableValue(a, sortConfig.key);
      const bValue = getSortableValue(b, sortConfig.key);

      console.log('Sorting values:', {
        key: sortConfig.key,
        direction: sortConfig.direction,
        aValue,
        bValue
      });

      // Handle string comparison for text fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = sortConfig.direction === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
        console.log('String comparison result:', result);
        return result;
      }

      // Handle numeric comparison for scores and percentiles
      const result = sortConfig.direction === 'asc' ? 
        aValue - bValue : 
        bValue - aValue;
      console.log('Numeric comparison result:', result);
      return result;
    });
  }, [filteredData, sortConfig]);

  console.log('Final Sorted Data:', sortedData);

  const calculateTotalScore = (topicId) => {
    console.log('Calculating score for topicId:', topicId);
    console.log('Report Data:', reportData);

    if (!reportData) {
      console.log('No report data available');
      return 0;
    }

    // Get the first unit's data
    const firstUnit = Object.values(reportData)[0];
    console.log('First Unit:', firstUnit);
    
    if (!firstUnit) {
      console.log('No unit data found');
      return 0;
    }

    // Get the first user's data
    const firstUser = Object.values(firstUnit)[0];
    console.log('First User:', firstUser);
    
    if (!firstUser?.topic_detail) {
      console.log('No topic detail found');
      return 0;
    }

    console.log('User topic_detail:', firstUser.topic_detail);
    
    // Get the topic data directly from user's topic_detail
    const topic = firstUser.topic_detail[topicId];
    if (topic) {
      console.log('Found topic:', topic);
      
      // Get the section data for correct_marks
      const sectionDetail = firstUser.section_detail;
      console.log('Section detail:', sectionDetail);
      
      if (sectionDetail) {
        // Get correct_marks directly from section_detail
        const correctMarks = parseFloat(sectionDetail.correct_marks || 0);
        // Get total_questions from topic
        const totalQuestions = parseFloat(topic.topic_total_question || 0);
        
        console.log('Score calculation details:', {
          correctMarks,
          totalQuestions,
          topicId,
          sectionId: sectionDetail.section_id,
          sectionName: sectionDetail.section_name,
          quizSectionId: sectionDetail.quiz_section_id,
          topicData: topic
        });
        
        if (!isNaN(correctMarks) && !isNaN(totalQuestions)) {
          // Multiply topic_total_question by correct_marks to get total possible marks
          const totalPossibleMarks = correctMarks * totalQuestions;
          console.log('Total possible marks calculation:', {
            correctMarks,
            totalQuestions,
            totalPossibleMarks
          });
          return totalPossibleMarks.toFixed(1);
        }
      }
    }

    console.log('No score found for topic', topicId);
    return 0;
  };

  // Add this function to get the actual score for a topic
  const getTopicScore = (topicId) => {
    if (!reportData) return 0;
    
    const firstUnit = Object.values(reportData)[0];
    if (!firstUnit) return 0;
    
    const firstUser = Object.values(firstUnit)[0];
    if (!firstUser?.topic_detail) return 0;
    
    const topic = firstUser.topic_detail[topicId];
    if (topic) {
      return parseFloat(topic.unit_topic_score_average || 0).toFixed(1);
    }
    
    return 0;
  };

  // Add this useEffect for debugging
  useEffect(() => {
    const firstUnit = reportData ? Object.values(reportData)[0] : null;
    const firstUser = firstUnit ? Object.values(firstUnit)[0] : null;
    const firstSection = firstUser?.section_detail ? Object.values(firstUser.section_detail)[0] : null;
    
    console.log('Component Data:', {
      reportData,
      relevantTopics,
      topicMappings,
      firstUnit,
      firstUser,
      topicDetail: firstUser?.topic_detail,
      sectionDetail: firstUser?.section_detail,
      firstSection,
      correctMarks: firstSection?.correct_marks,
      firstTopic: firstUser?.topic_detail ? Object.values(firstUser.topic_detail)[0] : null
    });
  }, [reportData, relevantTopics, topicMappings]);

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by unit, competency, score, or percentile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      {/* Legend for abbreviations */}
      <div className="competency-legend">
        <p><strong>Legend:</strong></p>
        <ul className="legend-list">
          {relevantTopics.map(({ topicId, name }) => (
            <li key={topicId}><strong>{topicAbbreviations[topicId]}</strong> - {name}</li>
          ))}
        </ul>
      </div>
<div style={{ overflowX: "auto", width: "100%" }}>

      <table className="competency-table">
        <thead>
          <tr>
            <th 
              className="sortable-header"
              onClick={() => handleSort('sno')}
              style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', cursor: 'pointer' }}
            >
              S.No
              <span className="sort-arrows">
                {getSortIcon('sno')}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort('unitName')}
              style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Unit
              <span className="sort-arrows">
                {getSortIcon('unitName')}
              </span>
            </th>
            <th 
              className="sortable-header"
              onClick={() => handleSort('totalScore')}
              style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', cursor: 'pointer' }}
            >
              Total Score (Out of {relevantTopics.reduce((sum, {topicId}) => sum + parseFloat(calculateTotalScore(topicId) || 0), 0).toFixed(1)})
              <span className="sort-arrows">
                {getSortIcon('totalScore')}
              </span>
            </th>
            {relevantTopics.map(({ topicId, name }) => {
              const abbr = topicAbbreviations[topicId];
              const totalScore = calculateTotalScore(topicId);
              return (
                <React.Fragment key={name}>
                  <th 
                    className="sortable-header"
                    onClick={() => handleSort(`${name}_score`)}
                    style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', cursor: 'pointer' }}
                  >
                    {abbr} - Score (Out of {totalScore})
                    <span className="sort-arrows">
                      {getSortIcon(`${name}_score`)}
                    </span>
                  </th>
                  <th 
                    className="sortable-header-mh-percentile"
                    onClick={() => handleSort(`${name}_percentile`)}
                    style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', cursor: 'pointer' }}
                  >
                    {abbr} - MH %ile
                    <span className="sort-arrows">
                      {getSortIcon(`${name}_percentile`)}
                    </span>
                  </th>
                </React.Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={2 + relevantTopics.length * 2} className="no-data-message">
                No data available for the search term '{searchTerm}'
              </td>
            </tr>
          ) : (
            sortedData.map((row) => (
              <tr key={row.sno}>
                <td>{row.sno}</td>
                <td>{row.unitName}</td>
                <td>
                  {row.subCompetencyStats.reduce((total, stat) => {
                    const score = parseFloat(safe(stat.unitAvgScore)) || 0;
                    return total + score;
                  }, 0).toFixed(2)}
                </td>
                {row.subCompetencyStats.map((stat) => (
                  <React.Fragment key={stat.name}>
                    <td>{safe(stat.unitAvgScore)}</td>
                    <td className="mh-percentile">
                      {renderPercentileBar(stat.mhPercentile)}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default UserSubCompetencyTable;
