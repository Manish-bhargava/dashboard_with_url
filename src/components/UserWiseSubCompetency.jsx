import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTable } from 'react-table';
import './CompetencyTable.css';
import { topics } from '../data/topics';
import { competencies } from '../data/competencies';

const UserWiseSubCompetency = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [uniqueUnits, setUniqueUnits] = useState([]);

  // Memoize the topic to competency mapping
  const topicToCompetency = useMemo(() => {
    const mapping = {};
    topics.forEach(topic => {
      const competency = competencies.find(c => c.id === topic.competencyId);
      if (competency) {
        mapping[topic.id] = competency.name;
      }
    });
    return mapping;
  }, []);

  // Extract unique units when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      const units = new Set();
      data.forEach(item => {
        if (item.unitName) units.add(item.unitName);
      });
      setUniqueUnits(Array.from(units));
      setIsLoading(false);
    }
  }, [data]);

  // Memoize the processed data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const rows = [];
    const studentMap = new Map();

    data.forEach(item => {
      if (!item.studentName || !item.unitName) return;

      let row = studentMap.get(item.studentName);
      if (!row) {
        row = {
          studentName: item.studentName,
          unitName: item.unitName,
          scores: {},
          totalScore: 0
        };
        studentMap.set(item.studentName, row);
      }

      const competencyName = topicToCompetency[item.topicId];
      if (competencyName) {
        if (!row.scores[competencyName]) {
          row.scores[competencyName] = {
            score: 0,
            count: 0,
            percentile: 0
          };
        }
        row.scores[competencyName].score += item.score || 0;
        row.scores[competencyName].count += 1;
        row.scores[competencyName].percentile = item.percentile || 0;
      }
    });

    // Calculate averages and total scores
    studentMap.forEach(row => {
      Object.values(row.scores).forEach(scoreData => {
        if (scoreData.count > 0) {
          scoreData.score = Math.round(scoreData.score / scoreData.count);
        }
        row.totalScore += scoreData.score;
      });
      rows.push(row);
    });

    return rows;
  }, [data, topicToCompetency]);

  // Memoize filtered data
  const filteredData = useMemo(() => {
    if (!searchTerm) return processedData;
    const searchLower = searchTerm.toLowerCase();
    return processedData.filter(row => 
      row.unitName.toLowerCase().includes(searchLower)
    );
  }, [processedData, searchTerm]);

  // Memoize sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue, bValue;

      if (sortConfig.key === 'totalScore') {
        aValue = a.totalScore;
        bValue = b.totalScore;
      } else if (sortConfig.key.startsWith('score-')) {
        const competency = sortConfig.key.replace('score-', '');
        aValue = a.scores[competency]?.score || 0;
        bValue = b.scores[competency]?.score || 0;
      } else if (sortConfig.key.startsWith('percentile-')) {
        const competency = sortConfig.key.replace('percentile-', '');
        aValue = a.scores[competency]?.percentile || 0;
        bValue = b.scores[competency]?.percentile || 0;
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [filteredData, sortConfig]);

  // Memoize columns
  const columns = useMemo(() => {
    const cols = [
      {
        Header: 'S.No',
        accessor: (row, index) => index + 1,
        width: 50
      },
      {
        Header: 'Unit',
        accessor: 'unitName',
        width: 100
      }
    ];

    // Add columns for each competency
    Object.entries(topicToCompetency).forEach(([topicId, competencyName]) => {
      cols.push({
        Header: competencyName,
        accessor: `scores.${competencyName}.score`,
        width: 100,
        Cell: ({ row }) => {
          const score = row.original.scores[competencyName]?.score || 0;
          const percentile = row.original.scores[competencyName]?.percentile || 0;
          return (
            <div>
              {score} ({percentile}%)
            </div>
          );
        }
      });
    });

    cols.push({
      Header: 'Total Score',
      accessor: 'totalScore',
      width: 100
    });

    return cols;
  }, [topicToCompetency]);

  // Memoize table instance
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow
  } = useTable({
    columns,
    data: sortedData
  });

  // Memoize event handlers
  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading data...</div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return <div className="no-data">No data available.</div>;
  }

  return (
    <div className="table-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by unit..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
        <div className="unit-list">
          <span className="unit-list-label">Available Units:</span>
          <div className="unit-list-items">
            {uniqueUnits.map(unit => (
              <span key={unit} className="unit-tag">{unit}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="table-wrapper">
        <table {...getTableProps()} className="competency-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th
                    {...column.getHeaderProps()}
                    style={{ width: column.width }}
                    onClick={() => handleSort(column.accessor)}
                  >
                    {column.render('Header')}
                    {sortConfig.key === column.accessor && (
                      <span className="sort-arrow">
                        {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserWiseSubCompetency; 