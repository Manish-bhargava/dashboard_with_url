import { useState, useEffect } from 'react';
import './shared.css';
import axios from 'axios';
import CompetencyTable from './CompetencyTable';
import * as XLSX from 'xlsx';
import { ClipLoader } from 'react-spinners'; // Import spinner component (if using `react-spinners`)

const UserWise = () => {
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);
  const [showTestsDropdown, setShowTestsDropdown] = useState(false);
  const [units, setUnits] = useState([]);
  const [quizList, setQuizList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasStudentNames, setHasStudentNames] = useState(false);

  useEffect(() => {
    const fetchUnitsAndQuizzes = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchUnitList();
        await fetchQuizList();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUnitsAndQuizzes();
  }, []);

  useEffect(() => {
    if (reportData && reportData.data) {
      const hasNames = Object.values(reportData.data).some(item => item.student_name || item.name);
      setHasStudentNames(hasNames);
    }
  }, [reportData]);

  const fetchUnitList = async () => {
    try {
      const response = await axios.post('https://mhbodhi.medtalent.co/api/reportanalytics/getUnitList', {}, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data.status === 'success') {
        const allUnits = [...response.data.units.North, ...response.data.units.South];
        setUnits(allUnits);
      } else {
        setError('Failed to fetch units. Status not "success".');
      }
    } catch (error) {
      console.error('❌ Error fetching unit list:', error);
    }
  };

  const fetchQuizList = async () => {
    try {
      const response = await axios.post('https://mhbodhi.medtalent.co/api/reportanalytics/getQuizList', {}, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data && Array.isArray(response.data)) {
        setQuizList(response.data);
      } else {
        setError('Failed to fetch quizzes: Data not in expected format.');
      }
    } catch (error) {
      console.error('❌ Error fetching quiz list:', error);
      setError('Could not fetch quiz list. Please try again later.');
    }
  };

  const handleApplyFilters = async () => {
    if (selectedUnits.length === 0 || selectedTests.length === 0) {
      setError('Please select both units and tests before applying filters.');
      return;
    }

    console.log("✅ Selected Units:", selectedUnits);
    console.log("✅ Selected Tests:", selectedTests);

    const selectedQuizIds = selectedTests.map(testName => {
      const quiz = quizList.find(quiz => quiz.quiz_name === testName);
      return quiz ? quiz.quiz_id : null;
    }).filter(quizId => quizId !== null);

    if (selectedQuizIds.length === 0) {
      setError('Invalid quiz selection.');
      return;
    }

    const requestBody = {
      unit: selectedUnits,
      quiz_id: selectedQuizIds
    };

    console.log("📦 Request Body:", requestBody);

    setLoading(true); // Start loading state before making the request

    try {
      const response = await axios.post('https://mhbodhi.medtalent.co/api/reportanalytics/getMainCompetencyUserReport', requestBody, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data?.status === "success") {
        setReportData(response.data);
      }
    } catch (error) {
      console.error('❌ Error fetching main competency report:', error);
      setError('Failed to fetch report.');
    } finally {
      setLoading(false); // End loading state
    }
  };

  const handleUnitSelect = (unit) => {
    if (selectedUnits.includes(unit)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unit));
    } else {
      setSelectedUnits([...selectedUnits, unit]);
    }
  };

  const handleTestSelect = (test) => {
    if (selectedTests.includes(test)) {
      setSelectedTests(selectedTests.filter(t => t !== test));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const toggleSelectAllUnits = () => {
    if (selectedUnits.length === units.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(units);
    }
  };

  const toggleSelectAllTests = () => {
    const allTestNames = quizList.map(quiz => quiz.quiz_name);
    if (selectedTests.length === quizList.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(allTestNames);
    }
  };

  const handleClear = () => {
    setSelectedUnits([]);
    setSelectedTests([]);
    setReportData(null);
  };

  const handleExport = () => {
    if (!reportData || !reportData.data) {
      alert('No data available to export.');
      return;
    }

    const data = reportData.data;
    const rows = [];

    Object.entries(data).forEach(([unitKey, unitData]) => {
      const quizDetails = unitData.quiz_detail || {};

      Object.entries(quizDetails).forEach(([quizId, studentMap]) => {
        Object.entries(studentMap).forEach(([studentId, studentData]) => {
          const userDetails = studentData.user_basic_detail || {};
          const studentName = userDetails.student_name || '-';
          const unitName = userDetails.unit_name || unitKey;
          const department = userDetails.department || '-';
          const totalScore = studentData.total_score?.[quizId] || '-';

          const quizData = studentData.quiz_detail?.[quizId];
          const sectionDetail = quizData?.section_detail || {};

          const row = {
            Student: studentName,
            Unit: unitName,
            Department: department,
            'Total Score': totalScore,
          };

          Object.values(sectionDetail).forEach((section) => {
            const sectionName = section.section_name;
            row[`${sectionName} Score`] = section.section_total_score;
            row[`${sectionName} MH %ile`] = section.section_percentile_score;
            row[`${sectionName} Unit %ile`] = section.unit_section_percentile_score;
          });

          rows.push(row);
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, 'UserWiseMainCompetencyReport.xlsx');
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div className="performance-reports">
      <h1>Performance Reports</h1>

      <div className="filters-row">
        {/* Units Filter */}
        <div className="dropdown-container">
          <div className="dropdown-header" onClick={() => setShowUnitsDropdown(!showUnitsDropdown)}>
            <span>{selectedUnits.length ? `${selectedUnits.length} Units Selected` : 'Select Units'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showUnitsDropdown && (
            <div className="dropdown-menu no-scroll">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedUnits.length === units.length}
                  onChange={toggleSelectAllUnits}
                />
                Select All Units
              </label>
              {loading ? (
                <div className="loading-message">
                  <ClipLoader size={20} color={"#3498db"} loading={loading} />
                  Loading units...
                </div>
              ) : error ? (
                <div className="error-message">{error}</div>
              ) : (
                units.map(unit => (
                  <label key={unit} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={selectedUnits.includes(unit)}
                      onChange={() => handleUnitSelect(unit)}
                    />
                    {unit}
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="dropdown-container">
          <div className="dropdown-header" onClick={() => setShowTestsDropdown(!showTestsDropdown)}>
            <span>{selectedTests.length ? `${selectedTests.length} Tests Selected` : 'Select Tests'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {showTestsDropdown && (
            <div className="dropdown-menu">
              <label className="dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedTests.length === quizList.length}
                  onChange={toggleSelectAllTests}
                />
                Select All Tests
              </label>
              {loading ? (
                <div className="loading-message">
                  <ClipLoader size={20} color={"#3498db"} loading={loading} />
                  Loading tests...
                </div>
              ) : quizList.map(quiz => (
                <label key={quiz.quiz_id} className="dropdown-item">
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(quiz.quiz_name)}
                    onChange={() => handleTestSelect(quiz.quiz_name)}
                  />
                  {quiz.quiz_name}
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="apply-btn" onClick={handleApplyFilters}>Apply </button>
        <button className="clear-btn" onClick={handleClear}>Clear</button>
      
        <button className="excel-btn" onClick={handleExport}>Excel</button>
      </div>

      <div className="report-content">
        <h2>User Wise Main Competency Report</h2>
        <p className="subtitle">Detailed analysis of main competencies by user</p>

        <div className="report-data">
          {selectedUnits.length === 0 && selectedTests.length === 0 ? (
            <div className="no-filters-message">
              Please select filters and click "Apply Filters" to view data
            </div>
          ) : (
            <div className={`results-content ${isZoomed ? 'zoomed' : ''}`}>
              {loading ? (
                <div className="loading-message">
                  <ClipLoader size={40} color={"#3498db"} loading={loading} />
                  Loading report...
                </div>
              ) : reportData ? (
                <>
                  <CompetencyTable data={reportData.data} searchTerm={searchTerm} />
                </>
              ) : (
                <p className="loading-message">Loading report...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserWise;
